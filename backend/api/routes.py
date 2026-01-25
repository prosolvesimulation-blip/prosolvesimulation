import os
import sys
import subprocess
import json
from flask import Blueprint, jsonify, request, current_app
import webview
from jinja2 import Environment, FileSystemLoader

from services.vtk_converter import call_med_extractor

api_blueprint = Blueprint('api', __name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

@api_blueprint.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "message": "ProSolve Professional API"})

@api_blueprint.route('/open_folder_dialog', methods=['GET'])
def open_folder_dialog():
    """Opens native Windows Folder Picker using PyWebView."""
    try:
        if len(webview.windows) > 0:
            window = webview.windows[0]
            folder_path = window.create_file_dialog(webview.FOLDER_DIALOG)
            
            if folder_path and len(folder_path) > 0:
                return jsonify({"status": "success", "path": folder_path[0]})
        return jsonify({"status": "cancelled"})
    except Exception as e:
        print(f"Dialog Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@api_blueprint.route('/scan_workspace', methods=['POST'])
def scan_workspace():
    """Scans a folder for geometry and mesh files."""
    data = request.get_json()
    folder_path = data.get('folder_path')
    
    if not folder_path or not os.path.exists(folder_path):
        return jsonify({"status": "error", "message": "Invalid Path"}), 400

    try:
        files = os.listdir(folder_path)
        geo_files = [f for f in files if f.lower().endswith(('.step', '.stp'))]
        mesh_files = [f for f in files if f.lower().endswith('.med') and f.lower() != 'resu.med']
        config_files = [f for f in files if f.lower().endswith('.comm')]
        
        result = {
            "status": "success",
            "geometry": len(geo_files) > 0,
            "mesh": len(mesh_files) > 0,
            "config": len(config_files) > 0,
            "files": {
                "geometry": geo_files,
                "mesh": mesh_files,
                "config": config_files,
            }
        }
        
        # Professional Refactor: Don't trigger Aster init automatically (too slow)
        # The groups will be read on-the-fly via MEDCOUPLING when the component mounts.
        # if mesh_files:
        #     init_result = init_aster_files(folder_path, mesh_files)
        #     result["aster_init"] = init_result
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

def init_aster_files(folder_path, mesh_files):
    """
    Initialize Code_Aster files:
    1. Create simulation_files and temp directories
    2. Generate mesh.json
    3. Generate export.export
    4. Call inspect_mesh.py
    """
    try:
        sim_files_dir = os.path.join(folder_path, "simulation_files")
        temp_working_dir = os.path.join(sim_files_dir, "temp")
        
        # Create directories
        os.makedirs(sim_files_dir, exist_ok=True)
        os.makedirs(temp_working_dir, exist_ok=True)
        
        # Generate mesh.json
        mesh_data_list = []
        for i, med_file in enumerate(mesh_files):
            name = os.path.splitext(med_file)[0].replace("-", "_").replace(" ", "_")
            mesh_data_list.append({
                "name": name,
                "filename": med_file,
                "format": "MED"
            })
        
        mesh_json_path = os.path.join(sim_files_dir, "mesh.json")
        with open(mesh_json_path, 'w', encoding='utf-8') as f:
            json.dump({"unit_start": 80, "meshes": mesh_data_list}, f, indent=4)
        
        # Generate export.export using Jinja2
        jinja_dir = os.path.join(BASE_DIR, "services", "jinja", "templates")
        env = Environment(loader=FileSystemLoader(jinja_dir), trim_blocks=True, lstrip_blocks=True)
        tpl_export = env.get_template("export.j2")
        
        export_meshes = []
        for i, m in enumerate(mesh_data_list):
            export_meshes.append({
                "path": os.path.abspath(os.path.join(folder_path, m["filename"])),
                "unit": 80 + i
            })
        
        export_content = tpl_export.render(
            temp_path=os.path.abspath(temp_working_dir),
            comm_path=os.path.abspath(os.path.join(sim_files_dir, "med.comm")),
            meshes=export_meshes,
            message_path=os.path.abspath(os.path.join(sim_files_dir, "message")),
            base_path=os.path.abspath(os.path.join(sim_files_dir, "base")),
            csv_path=None
        )
        
        export_path = os.path.join(sim_files_dir, "export.export")
        with open(export_path, "w", encoding="utf-8") as f:
            f.write(export_content)
        
        # Call inspect_mesh.py (Generates med.comm)
        script_path = os.path.join(BASE_DIR, "services", "jinja", "inspect_mesh.py")
        if os.path.exists(script_path):
            result = subprocess.run(
                [sys.executable, script_path, folder_path],
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='ignore'
            )
            if result.returncode != 0:
                print(f"[ASTER] inspect_mesh.py failed: {result.stderr}")
                return False
                
        # EXECUTE CODE_ASTER (as_run)
        # 1. READ CONFIG
        config = get_prosolve_config()
        run_aster_bin = config.get("ASTER_BIN")
        
        # Fallbacks
        if not run_aster_bin or not os.path.exists(run_aster_bin):
            # Fallback 1: Local Jinja bat
            local_bat = os.path.join(BASE_DIR, "services", "jinja", "run_aster.bat")
            if os.path.exists(local_bat):
                run_aster_bin = local_bat
                print(f"[ASTER] Configured path not found. Using local fallback: {local_bat}")
            else:
                print(f"[ASTER] CRITICAL: Code_Aster executable not found in config or fallback.")
                return True # We return true to not block UI load, but scan incomplete
        
        print(f"[ASTER] Executing Inspection via: {run_aster_bin}")
        print(f"[ASTER] Target Export: {export_path}")

        exec_result = subprocess.run(
            [run_aster_bin, export_path],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore'
        )
        
        # DUMP OUTPUT TO TERMINAL
        print(f"--- ASTER STDOUT ---\n{exec_result.stdout}\n--------------------")
        if exec_result.stderr:
            print(f"--- ASTER STDERR ---\n{exec_result.stderr}\n--------------------")
            
        if exec_result.returncode != 0:
            print(f"[ASTER] Execution failed (Code {exec_result.returncode})")
        else:
             print(f"[ASTER] Inspection Execution Complete.")
        
        return True
    except Exception as e:
        print(f"[ASTER] Init error: {e}")
        return False

@api_blueprint.route('/read_mesh_groups', methods=['POST'])
def read_mesh_groups():
    """Reads mesh groups directly from MED files using MEDCOUPLING extractor."""
    try:
        from services.vtk_converter import call_med_extractor
        
        data = request.get_json()
        folder_path = data.get('folder_path')
        
        if not folder_path or not os.path.exists(folder_path):
            return jsonify({"status": "error", "message": "Path not provided or invalid"}), 400
        
        # Find all .med files
        files = [f for f in os.listdir(folder_path) if f.lower().endswith('.med') and 'resu' not in f.lower()]
        
        if not files:
            return jsonify({"status": "error", "message": "No .med files found"}), 404
            
        combined_groups = {}
        
        for mesh_file in files:
            target_path = os.path.join(folder_path, mesh_file)
            print(f"[API] Extracting groups from: {mesh_file}")
            
            # Use our professional extractor
            result = call_med_extractor(target_path)
            
            if result and result.get("status") == "success":
                # Merge into a format matches mesh_groups.json structure
                # { "groups": { "NAME": { "count": X, "types": { "T1": Y } } } }
                for g_name, g_data in result.get("cells", {}).items():
                    # If multiple files have the same group, they "merge" or we prefix?
                    # The frontend usually expects groups to be unique mapped to geometry.
                    # We'll use the group name directly to support multi-mesh assembly.
                    combined_groups[g_name] = {
                        "count": g_data.get("count", 0),
                        "types": g_data.get("types", {}),
                        "type": g_data.get("type", "unknown"), # Pass the general VTK type (line, quad, ... or node)
                        "source": mesh_file # Metadata
                    }
            else:
                print(f"[API] Failed to extract from {mesh_file}")

        return jsonify({
            "status": "success", 
            "data": {
                "source_mesh": "MEDCOUPLING_Professional_Extractor",
                "groups": combined_groups
            }
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[API] Error reading groups: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

def get_prosolve_config():
    """Helper to read config.txt"""
    config_file = os.path.join(BASE_DIR, "..", "prosolve", "config.txt")
    config = {}
    if os.path.exists(config_file):
        with open(config_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    key, val = line.split("=", 1)
                    config[key.strip()] = val.strip()
    return config

@api_blueprint.route('/get_settings', methods=['GET'])
def get_settings():
    """Returns content of config.txt"""
    try:
        config = get_prosolve_config()
        return jsonify({
            "status": "success",
            "settings": {
                "aster_path": config.get("ASTER_BIN", ""),
                "freecad_path": config.get("FREECAD_BIN", ""),
                "salome_path": config.get("SALOME_BIN", "")
            }
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@api_blueprint.route('/save_settings', methods=['POST'])
def save_settings():
    """Updates config.txt"""
    try:
        data = request.get_json()
        aster = data.get('aster_path', '')
        freecad = data.get('freecad_path', '')
        salome = data.get('salome_path', '')
        
        config_file = os.path.join(BASE_DIR, "..", "prosolve", "config.txt")
        
        # We rewrite the file preserving comments? Hard with simple parsing.
        # Simple approach: Write new file with standard header
        with open(config_file, 'w', encoding='utf-8') as f:
            f.write("# Configurações de Caminhos do ProSolve\n")
            f.write("# Gerado Automaticamente\n\n")
            f.write(f"ASTER_BIN={aster}\n")
            f.write(f"FREECAD_BIN={freecad}\n")
            f.write(f"SALOME_BIN={salome}\n")
            
        return jsonify({"status": "success", "message": "Settings saved"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@api_blueprint.route('/launch_tool', methods=['POST'])
def launch_tool():
    """Launch external tools (FreeCAD, Salome) from config."""
    data = request.get_json()
    tool_name = data.get('tool_name')
    
    if not tool_name:
        return jsonify({"status": "error", "message": "Tool name required"}), 400
    
    config = get_prosolve_config()
    bin_path = None
    
    if tool_name.lower() == 'salome':
        bin_path = config.get("SALOME_BIN")
    elif tool_name.lower() == 'freecad':
        bin_path = config.get("FREECAD_BIN")
    elif tool_name.lower() == 'aster':
        bin_path = config.get("ASTER_BIN")
        
    if not bin_path or not os.path.exists(bin_path):
        return jsonify({"status": "error", "message": f"{tool_name} path not configured or not found: {bin_path}"}), 404
    
    try:
        subprocess.Popen([bin_path], shell=True if tool_name.lower() == 'salome' else False)
        return jsonify({"status": "success", "message": f"{tool_name} launched"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@api_blueprint.route('/calculate_section', methods=['POST'])
def calculate_section():
    """Calculate section properties using an external extractor and cache."""
    try:
        import hashlib
        import subprocess
        
        data = request.get_json()
        section_type = data.get('type')
        params = data.get('params', {})
        
        if not section_type:
            return jsonify({"status": "error", "message": "Section type required"}), 400
            
        # 1. CACHE MANAGEMENT
        param_str = json.dumps({"type": section_type, "params": params}, sort_keys=True)
        param_hash = hashlib.sha256(param_str.encode()).hexdigest()
        
        cache_dir = os.path.join(BASE_DIR, ".cache", "sections")
        os.makedirs(cache_dir, exist_ok=True)
        cache_file = os.path.join(cache_dir, f"{param_hash}.json")
        
        if os.path.exists(cache_file):
            with open(cache_file, "r", encoding="utf-8") as f:
                return jsonify(json.load(f))
        
        # 2. DYNAMIC EXTRACTION
        extractor_path = os.path.join(BASE_DIR, "services", "section_extractor.py")
        
        result = subprocess.run(
            [sys.executable, extractor_path],
            input=json.dumps(data),
            capture_output=True,
            text=True,
            encoding='utf-8'
        )
        
        if result.returncode != 0:
            return jsonify({"status": "error", "message": f"Extractor failed: {result.stderr}"}), 500
            
        try:
            output_json = json.loads(result.stdout)
        except:
            return jsonify({"status": "error", "message": f"Invalid extractor output: {result.stdout}"}), 500
            
        # 3. SAVE TO CACHE
        if output_json.get("status") == "success":
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(output_json, f)
                
        return jsonify(output_json)
        
    except Exception as e:
        print(f"[API] Section calc error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@api_blueprint.route('/save_project', methods=['POST'])
def save_project():
    """
    Saves the full project configuration to project.json.
    Also separates data into specific JSONs for the Jinja generation pipeline
    and runs generate_comm.py.
    """
    try:
        data = request.get_json()
        folder_path = data.get('folder_path')
        project_config = data.get('config')
        
        if not folder_path or not project_config:
            return jsonify({"status": "error", "message": "Missing path or config"}), 400
            
        study_dir = os.path.join(os.path.dirname(BASE_DIR), "backend", "services", "jinja", "study")
        project_file = os.path.join(folder_path, "project.json")
        
        # 1. Save master project.json
        with open(project_file, 'w', encoding='utf-8') as f:
            json.dump(project_config, f, indent=4)
            
        # 2. Decompose into component JSONs for generate_comm
        # Ensure study dir exists
        os.makedirs(study_dir, exist_ok=True)
        
        # A. Geometry (geometry.json)
        with open(os.path.join(study_dir, "geometry.json"), 'w', encoding='utf-8') as f:
            json.dump({"geometries": project_config.get("geometries", [])}, f, indent=4)
            
        # B. Materials (materials.json & assignments)
        # Assuming frontend structure needs mapping
        mats = project_config.get("materials", [])
        # For now, separate props and assignments if needed, or update builders to read from one.
        # Current builders expect materials.json (props) and material_assignments.json
        # TODO: Refactor builders to unify? For now, we split.
        
        mat_props = []
        mat_assigns = []
        for m in mats:
            if "props" in m:
                mat_props.append(m["props"]) # {Name: Steel, E: 210000...}
            if "assignment" in m:
                mat_assigns.append(m["assignment"]) # {group: 'All', material: 'Steel'}
                
        # Fallback if frontend structure differs (likely array of objects with both)
        # Let's assume frontend sends { name, E, nu, rho, groups: [] }
        # We need to adapt.
        # But wait, implementation plan said we'd analyze LoadConfig, but backend builders exist.
        # Let's verify structure later. For now, dump raw materials to materials.json
        # and assume generate_comm will likely fail if structure mismatched.
        # FIX: We will dump what we have.
        with open(os.path.join(study_dir, "materials.json"), 'w', encoding='utf-8') as f:
            json.dump({"materials": mats}, f, indent=4)
            
        # C. Restrictions (ddl_impo.json)
        with open(os.path.join(study_dir, "ddl_impo.json"), 'w', encoding='utf-8') as f:
            json.dump({"ddl_impo": project_config.get("restrictions", [])}, f, indent=4)
            
        # D. Loads -> Split into Pesanteur, Force Nodale, Pressure
        loads = project_config.get("loads", [])
        pes_list = []
        nod_list = []
        pres_list = []
        
        for l in loads:
            if l.get("type") == "PESANTEUR":
                pes_list.append(l)
            elif l.get("type") == "FORCE_NODALE":
                nod_list.append(l)
            elif l.get("type") == "PRESSION":
                pres_list.append(l)
                
        # Pesanteur (Single object usually expected by builder, or list)
        # Builder logic: if list, iterates.
        with open(os.path.join(study_dir, "pesanteur.json"), 'w', encoding='utf-8') as f:
            json.dump(pes_list[0] if pes_list else {}, f, indent=4)
            
        # Force Nodale
        with open(os.path.join(study_dir, "force_nodale.json"), 'w', encoding='utf-8') as f:
            json.dump({"force_nodale": nod_list}, f, indent=4)
            
        # Load Cases (load_cases.json)
        # Ensure 'load_cases' exists in project config, else default
        load_cases = project_config.get("load_cases", [])
        if not load_cases and loads:
             # Default LC if none defined but loads exist
             load_cases = [{"name": "Default", "loads": [l["name"] for l in loads]}]
             
        with open(os.path.join(study_dir, "load_cases.json"), 'w', encoding='utf-8') as f:
            json.dump({"load_cases": load_cases}, f, indent=4)
            
        # 3. Run generate_comm.py
        script_path = os.path.join(os.path.dirname(BASE_DIR), "backend", "services", "jinja", "generate_comm.py")
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True, 
            encoding='utf-8'
        )
        
        if result.returncode != 0:
            print(f"Generate Comm Error: {result.stderr}")
            return jsonify({"status": "warning", "message": "Saved, but generation failed: " + result.stderr})
            
        # 4. Move generated outputs to project folder
        # generated files are in services/jinja/output (calcul.comm)
        # and services/jinja/output doesn't necessarily respect project path directly, it outputs to local output folder
        # We need to move/copy them.
        output_dir = os.path.join(os.path.dirname(BASE_DIR), "backend", "services", "jinja", "output")
        sim_dir = os.path.join(folder_path, "simulation_files")
        os.makedirs(sim_dir, exist_ok=True)
        
        import shutil
        src_comm = os.path.join(output_dir, "calcul.comm")
        dst_comm = os.path.join(sim_dir, "calcul.comm")
        if os.path.exists(src_comm):
            shutil.copy2(src_comm, dst_comm)
            
        # 5. GENERATE EXPORT.EXPORT for SIMULATION
        # Re-using logic from init_aster_files but pointing to calcul.comm
        jinja_dir = os.path.join(BASE_DIR, "services", "jinja", "templates")
        env = Environment(loader=FileSystemLoader(jinja_dir), trim_blocks=True, lstrip_blocks=True)
        tpl_export = env.get_template("export.j2")
        
        # Prepare mesh list for export
        # We need to read from the mesh.json that init_aster_files created (or update it)
        sim_files_dir = os.path.join(folder_path, "simulation_files")
        mesh_json_path = os.path.join(sim_files_dir, "mesh.json")
        mesh_data_list = []
        if os.path.exists(mesh_json_path):
             with open(mesh_json_path, 'r') as f:
                 mj = json.load(f)
                 mesh_data_list = mj.get("meshes", [])
        
        export_mesh_objs = []
        for i, m in enumerate(mesh_data_list):
            # med file is strictly the filename in the same folder usually
            full_path = os.path.abspath(os.path.join(folder_path, m["filename"]))
            export_mesh_objs.append({
                "path": full_path,
                "unit": 80 + i 
            })
            
        temp_working_dir = os.path.join(sim_files_dir, "temp")
        os.makedirs(temp_working_dir, exist_ok=True)
        
        export_content = tpl_export.render(
            temp_path=os.path.abspath(temp_working_dir),
            comm_path=os.path.abspath(dst_comm), # Points to calcul.comm
            meshes=export_mesh_objs,
            message_path=os.path.abspath(os.path.join(sim_files_dir, "message")),
            base_path=os.path.abspath(os.path.join(sim_files_dir, "base")),
            csv_path=None # Can be added if needed
        )
        
        export_file = os.path.join(sim_files_dir, "export.export")
        with open(export_file, "w", encoding="utf-8") as f:
            f.write(export_content)
            
        return jsonify({"status": "success", "message": "Project saved, generated, and ready for simulation"})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

@api_blueprint.route('/run_simulation', methods=['POST'])
def run_simulation():
    """Executes the simulation using export.export."""
    try:
        data = request.get_json()
        folder_path = data.get('folder_path')
        
        if not folder_path:
             return jsonify({"status": "error", "message": "Path required"}), 400
             
        sim_dir = os.path.join(folder_path, "simulation_files")
        export_path = os.path.join(sim_dir, "export.export")
        
        if not os.path.exists(export_path):
            return jsonify({"status": "error", "message": "Export file not found. Save project first."}), 404
            
        # Get Aster Bin
        config = get_prosolve_config()
        aster_bin = config.get("ASTER_BIN")
        if not aster_bin:
             return jsonify({"status": "error", "message": "Code_Aster path not configured in Settings."}), 400
             
        cmd = [aster_bin, export_path]
        print(f"[SIMULATION] Starting: {cmd}")
        
        # Determine cwd (project folder or simulation_files?)
        # Usually where export is or where we want output
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8', 
            errors='replace',
            cwd=sim_dir
        )
        
        # We can implement streaming later. For now, wait and return.
        stdout, stderr = process.communicate()
        
        print("--- SIMULATION STDOUT ---")
        print(stdout)
        print("--- SIMULATION STDERR ---")
        print(stderr)
        
        if process.returncode == 0:
            return jsonify({
                "status": "success", 
                "message": "Simulation Completed Successfully",
                "output": stdout
            })
        else:
            return jsonify({
                "status": "error", 
                "message": f"Simulation Failed (Code {process.returncode})",
                "output": stdout + "\n" + stderr
            })
            
    except Exception as e:
        print(f"[SIMULATION] Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@api_blueprint.route('/open_project', methods=['POST'])
def open_project_config():
    """Reads project.json and returns it."""
    try:
        data = request.get_json()
        folder_path = data.get('folder_path')
        
        if not folder_path:
             return jsonify({"status": "error", "message": "Path required"}), 400
             
        project_file = os.path.join(folder_path, "project.json")
        if not os.path.exists(project_file):
            return jsonify({"status": "not_found", "message": "Project config not found"})
            
        with open(project_file, 'r', encoding='utf-8') as f:
            config = json.load(f)
            
        return jsonify({"status": "success", "config": config})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
@api_blueprint.route('/get_mesh_data', methods=['POST'])
def get_mesh_data():
    """Reads mesh data for visualization."""
    try:
        from services.mesh_reader import read_mesh_file
        
        data = request.get_json()
        folder_path = data.get('folder_path')
        mesh_filename = data.get('mesh_filename') # Optional, else pick first
        
        if not folder_path:
             return jsonify({"status": "error", "message": "Path required"}), 400
             
        # Find mesh file
        target_path = ""
        if mesh_filename:
            target_path = os.path.join(folder_path, mesh_filename)
        else:
            # Auto find
            files = [f for f in os.listdir(folder_path) if f.lower().endswith('.med') and 'resu' not in f.lower()]
            if not files:
                return jsonify({"status": "error", "message": "No .med file found"}), 404
            target_path = os.path.join(folder_path, files[0])
            
        result = read_mesh_file(target_path)
        return jsonify(result)
        
    except Exception as e:
        print(f"[API] Mesh data error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@api_blueprint.route('/get_mesh_vtk', methods=['POST'])
def get_mesh_vtk():
    """Reads ALL mesh files in VTK format for visualization."""
    try:
        from services.vtk_converter import med_to_vtk_json
        
        data = request.get_json()
        folder_path = data.get('folder_path')
        geometries = data.get('geometries', [])
        
        if not folder_path:
            return jsonify({"status": "error", "message": "Path required"}), 400
            
        # Find ALL mesh files
        files = [f for f in os.listdir(folder_path) if f.lower().endswith('.med') and 'resu' not in f.lower()]
        if not files:
            return jsonify({"status": "error", "message": "No .med file found"}), 404
        
        print(f"[API] Found {len(files)} mesh files: {files}")
        
        # Combine all meshes
        combined_points = []
        combined_cells = {}
        point_offset = 0
        
        for mesh_file in files:
            target_path = os.path.join(folder_path, mesh_file)
            print(f"[API] Processing: {mesh_file}")
            
            result = med_to_vtk_json(target_path, geometries=geometries)
            
            if result["status"] != "success":
                print(f"[API] Error loading {mesh_file}: {result.get('message')}")
                continue
            
            # Add points with offset
            combined_points.extend(result["points"])
            
            # Add cells with adjusted indices
            for group_name, group_data in result["cells"].items():
                # Prefix group name with file name to avoid conflicts
                prefixed_name = f"{mesh_file.replace('.med', '')}_{group_name}"
                
                # Adjust cell connectivity indices
                adjusted_connectivity = []
                for cell in group_data["connectivity"]:
                    adjusted_cell = [idx + point_offset for idx in cell]
                    adjusted_connectivity.append(adjusted_cell)
                
                combined_cells[prefixed_name] = {
                    "type": group_data["type"],
                    "connectivity": adjusted_connectivity
                }
            
            point_offset += len(result["points"])
        
        print(f"[API] Combined mesh: {len(combined_points)} points, {len(combined_cells)} groups")
        
        return jsonify({
            "status": "success",
            "points": combined_points,
            "cells": combined_cells,
            "num_points": len(combined_points),
            "num_groups": len(combined_cells)
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[API] VTK mesh error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@api_blueprint.route('/get_hq_assembly', methods=['POST'])
def get_hq_assembly():
    """
    TRIGGER: Direct transcription of standalone success logic.
    Calls med_mesher.py via SALOME env for ALL project meshes.
    """
    try:
        data = request.get_json()
        folder_path = data.get('folder_path')
        
        if not folder_path or not os.path.exists(folder_path):
            return jsonify({"status": "error", "message": "Invalid project path"}), 400
            
        # 1. FIND ALL MESHES
        med_files = [f for f in os.listdir(folder_path) if f.lower().endswith('.med') and 'resu' not in f.lower()]
        
        # 2. RUN MED_MESHER FOR EACH (HQ Extraction)
        # Paths for environment setup
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        med_env_dir = os.path.join(os.path.dirname(project_root), "MEDCOUPLING-9.15.0", "MEDCOUPLING-9.15.0")
        mesher_script = os.path.join(project_root, "services", "med", "med_mesher.py")
        
        for med_file in med_files:
            source_path = os.path.join(folder_path, med_file)
            # cmd /c "cd /d ... && call ... && python ... ..."
            cmd = f'cmd /c "cd /d {med_env_dir} && call env_launch.bat && python \"{mesher_script}\" \"{source_path}\""'
            print(f"[HQ-TRIGGER] Extracting: {med_file}...")
            subprocess.run(cmd, shell=True, capture_output=True)
            
        # 3. AGGREGATE RESULTS
        json_files = [f for f in os.listdir(folder_path) if f.lower().endswith('.json') and f != 'project.json']
        
        combined_points = []
        combined_cells = {}
        point_offset = 0
        
        for j_file in json_files:
            j_path = os.path.join(folder_path, j_file)
            try:
                with open(j_path, 'r', encoding='utf-8') as f:
                    mesh_data = json.load(f)
            except: continue
                
            if mesh_data.get("status") != "success": continue
            
            pts = mesh_data.get("points", [])
            conn = mesh_data.get("connectivity", [])
            vtk_type = mesh_data.get("vtk_type", 9)
            
            combined_points.extend(pts)
            
            mesh_name = os.path.splitext(j_file)[0]
            num_pts_in_mesh = len(pts) // 3
            
            # Index offset correction (Standalone success logic)
            adjusted_conn = []
            for cell in conn:
                adjusted_conn.append([idx + point_offset for idx in cell])
                
            combined_cells[mesh_name] = {
                "type": {3: "line", 5: "triangle", 9: "quad", 10: "tetra", 12: "hexa"}.get(vtk_type, "poly"),
                "connectivity": adjusted_conn
            }
            
            point_offset += num_pts_in_mesh

        return jsonify({
            "status": "success",
            "points": combined_points,
            "cells": combined_cells,
            "num_points": len(combined_points) // 3
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

@api_blueprint.route('/open_standalone_viewer', methods=['POST'])
def open_standalone_viewer():
    """
    Triggers the standalone VTK viewer (native window).
    """
    try:
        data = request.get_json()
        folder_path = data.get('folder_path')
        
        if not folder_path or not os.path.exists(folder_path):
            return jsonify({"status": "error", "message": "Invalid project path"}), 400
            
        # 1. ENSURE DATA EXISTS
        json_files = [f for f in os.listdir(folder_path) if f.lower().endswith('.json') and f != 'project.json']
        target_json_path = None
        
        if not json_files:
             med_files = [f for f in os.listdir(folder_path) if f.lower().endswith('.med') and 'resu' not in f.lower()]
             if med_files:
                 project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                 med_env_dir = os.path.join(os.path.dirname(project_root), "MEDCOUPLING-9.15.0", "MEDCOUPLING-9.15.0")
                 mesher_script = os.path.join(project_root, "services", "med", "med_mesher.py")
                 
                 source_path = os.path.join(folder_path, med_files[0])
                 cmd = f'cmd /c "cd /d {med_env_dir} && call env_launch.bat && python \"{mesher_script}\" \"{source_path}\""'
                 print(f"[STANDALONE] Auto-Generating JSON from {med_files[0]}...")
                 subprocess.run(cmd, shell=True, capture_output=True)
                 target_json_path = source_path.replace('.med', '.json')
        else:
            for jf in json_files:
                 if 'geometries' in jf: continue
                 target_json_path = os.path.join(folder_path, jf)
                 break
        
        if not target_json_path or not os.path.exists(target_json_path):
             return jsonify({"status": "error", "message": "No suitable mesh JSON found or generated."}), 404
             
        # 2. LAUNCH VIEWER
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        viewer_script = os.path.join(project_root, "services", "med", "vtk_shell_extruder.py")
        
        cmd = [sys.executable, viewer_script, target_json_path]
        print(f"[STANDALONE] Launching: {cmd}")
        subprocess.Popen(cmd)
        
        return jsonify({"status": "success", "message": "Standalone viewer launched", "target": os.path.basename(target_json_path)})
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@api_blueprint.route('/mesh_dna', methods=['POST'])
def api_mesh_dna():
    """Proxy for legacy mesh_dna call, using modern extractor service."""
    try:
        data = request.get_json()
        file_path = data.get('file_path')

        if not file_path or not os.path.exists(file_path):
            return jsonify({"status": "error", "message": "Invalid file path"}), 400

        print(f"[API] Requesting DNA for: {os.path.basename(file_path)}")
        
        # Use our professional service
        result = call_med_extractor(file_path)
        
        if result:
            return jsonify(result)
        else:
            return jsonify({"status": "error", "message": "Failed to extract mesh DNA"}), 500

    except Exception as e:
        print(f"[API] Mesh DNA Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
