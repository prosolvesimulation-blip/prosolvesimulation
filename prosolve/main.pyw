import sys
import os
import subprocess
import json
from flask import Flask, jsonify, request
from flask_cors import CORS
from jinja2 import Environment, FileSystemLoader
import ctypes
from ctypes import wintypes
import logging



import io
import base64
import matplotlib
matplotlib.use('Agg') # Backend não-interativo
import matplotlib.pyplot as plt
from sectionproperties.pre.library import (
    rectangular_section, 
    rectangular_hollow_section, 
    circular_section, 
    circular_hollow_section,
    mono_i_section  # IMPORTANTE: Usar este para I assimétrico
)
from sectionproperties.analysis.section import Section
import matplotlib.pyplot as plt
import io
import base64





# --- CONFIGURAÇÃO GERAL ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "config.txt")

def get_config_value(key):
    """Lê uma chave do arquivo config.txt"""
    if not os.path.exists(CONFIG_FILE):
        print(f"[CONFIG] Erro: Arquivo {CONFIG_FILE} não encontrado.")
        return None
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                # Ignora comentários e linhas vazias
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if line.startswith(key + "="):
                    return line.split('=', 1)[1].strip()
    except Exception as e:
        print(f"[CONFIG] Erro ao ler config: {e}")
    return None

# --- INICIALIZAÇÃO FLASK ---
app = Flask(__name__)
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

CORS(app, resources={r"/api/*": {
    "origins": ["*"],
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type", "Accept"],
    "expose_headers": ["Content-Type"]
}})

@app.after_request
def add_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Accept'
    response.headers['Cross-Origin-Opener-Policy'] = 'same-origin'
    response.headers['Cross-Origin-Embedder-Policy'] = 'require-corp'
    return response

# --- FUNÇÕES DE ARQUIVO ---

def scan_workspace(folder_path):
    if not folder_path or not os.path.exists(folder_path):
        return {"Geometry": False, "Mesh": False, "Config": False, "Post-Pro": False, "files": {}}
    
    try:
        files = os.listdir(folder_path)
    except Exception as e:
        return {"Geometry": False, "Mesh": False, "Config": False, "Post-Pro": False, "files": {}}
    
    geo_files = [f for f in files if f.lower().endswith(('.step', '.stp'))]
    mesh_files = [f for f in files if f.lower().endswith('.med') and f.lower() != 'resu.med']
    config_files = [f for f in files if f.lower().endswith('.comm')]
    post_files = [f for f in files if f.lower().endswith(('.pvd', '.vtk', '.vtu'))]
    
    return {
        "Geometry": len(geo_files) > 0,
        "Mesh": len(mesh_files) > 0,
        "Config": len(config_files) > 0,
        "Post-Pro": len(post_files) > 0,
        "files": {
            "Geometry": geo_files,
            "Mesh": mesh_files,
            "Config": config_files,
            "Post-Pro": post_files
        }
    }

def init_aster_files(folder_path, mesh_files):
    """
    1. Cria simulation_files e simulation_files/temp
    2. Gera mesh.json
    3. Gera export.export (Com path temp configurado)
    4. Chama inspect_mesh.py
    """
    print(f"\n[ASTER] --- INICIANDO PREPARACAO ---")
    print(f"[ASTER] Pasta do Projeto: {folder_path}")
    
    if not mesh_files: return False

    # Define pastas
    sim_files_dir = os.path.join(folder_path, "simulation_files")
    temp_working_dir = os.path.join(sim_files_dir, "temp")

    # Cria pastas
    if not os.path.exists(sim_files_dir):
        try: os.makedirs(sim_files_dir, exist_ok=True)
        except: return False
            
    if not os.path.exists(temp_working_dir):
        try: os.makedirs(temp_working_dir, exist_ok=True)
        except: return False
    
    # 1. GERAR mesh.json
    mesh_data_list = []
    for i, med_file in enumerate(mesh_files):
        name = os.path.splitext(med_file)[0].replace("-", "_").replace(" ", "_")
        mesh_data_list.append({
            "name": name,
            "filename": med_file, 
            "format": "MED"
        })
    
    mesh_json_path = os.path.join(sim_files_dir, "mesh.json")
    try:
        with open(mesh_json_path, 'w', encoding='utf-8') as f:
            json.dump({"unit_start": 80, "meshes": mesh_data_list}, f, indent=4)
        print(f"[ASTER] mesh.json gerado.")
    except Exception as e:
        print(f"[ASTER] [ERRO] Falha ao salvar mesh.json: {e}")
        return False

    # 2. GERAR export.export
    try:
        jinja_dir = os.path.join(os.path.dirname(BASE_DIR), "jinja", "templates")
        if not os.path.exists(jinja_dir): return False

        env = Environment(loader=FileSystemLoader(jinja_dir), trim_blocks=True, lstrip_blocks=True)
        tpl_export = env.get_template("export.j2")
        
        export_meshes = []
        for i, m in enumerate(mesh_data_list):
             export_meshes.append({
                "path": os.path.abspath(os.path.join(folder_path, m["filename"])),
                "unit": 80 + i
            })
            
        export_content = tpl_export.render(
            temp_path=os.path.abspath(temp_working_dir), # Caminho para arquivos temp do Aster
            comm_path=os.path.abspath(os.path.join(sim_files_dir, "med.comm")),
            meshes=export_meshes,
            message_path=os.path.abspath(os.path.join(sim_files_dir, "message")),
            base_path=os.path.abspath(os.path.join(sim_files_dir, "base")),
            csv_path=None 
        )
        
        export_path = os.path.join(sim_files_dir, "export.export")
        with open(export_path, "w", encoding="utf-8") as f:
            f.write(export_content)
        print(f"[ASTER] export.export gerado em: {export_path}")
        
    except Exception as e:
        print(f"[ASTER] [ERRO] Falha ao gerar export: {e}")
        return False

    # 3. CHAMAR inspect_mesh.py
    script_path = os.path.join(os.path.dirname(BASE_DIR), "jinja", "inspect_mesh.py")
    if not os.path.exists(script_path): return False

    print(f"[ASTER] Executando gerador .comm...")
    try:
        result = subprocess.run(
            [sys.executable, script_path, folder_path],
            capture_output=True, text=True, encoding='utf-8', errors='ignore'
        )
        
        if result.returncode != 0:
            print(f"[ASTER] [ERRO] inspect_mesh.py falhou:\n{result.stderr}")
            return False
        else:
            print(f"[ASTER] med.comm gerado com sucesso.")
            
    except Exception as e:
        print(f"[ASTER] Falha ao executar subprocesso: {e}")
        return False

    return True

def run_simulation_async(folder_path):
    """Chama o wrapper run_aster.py passando o arquivo export"""
    # Procura run_aster.py na mesma pasta do main.pyw
    script_path = os.path.join(BASE_DIR, "run_aster.py")
    python_exe = sys.executable 
    
    # Caminho do export
    export_file = os.path.join(folder_path, "simulation_files", "export.export")
    
    print(f"[ASTER] Disparando Code_Aster...")
    print(f"        Wrapper: {script_path}")
    print(f"        Export:  {export_file}")
    
    if not os.path.exists(script_path):
        print(f"[ASTER] [ERRO] run_aster.py não encontrado.")
        return False
        
    if not os.path.exists(export_file):
        print(f"[ASTER] [ERRO] Arquivo export.export não encontrado.")
        return False

    try:
        # Chama o wrapper Python
        subprocess.Popen([python_exe, script_path, export_file], 
                         close_fds=True, 
                         creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        return True
    except Exception as e:
        print(f"[API] Error triggering simulation: {e}")
        return False

def launch_tool(tool_name):
    """Launch external tools using paths from config.txt"""
    bin_path = None
    
    if tool_name == 'FreeCAD':
        bin_path = get_config_value("FREECAD_BIN")
    elif tool_name == 'Salome':
        bin_path = get_config_value("SALOME_BIN")
    
    if not bin_path:
        return {"status": "error", "message": f"Caminho para {tool_name} não configurado no config.txt"}
        
    if not os.path.exists(bin_path):
        return {"status": "error", "message": f"Executável não encontrado: {bin_path}"}

    try:
        working_dir = os.path.dirname(bin_path)
        # Salome geralmente é um .bat, precisa de shell=True
        use_shell = tool_name == 'Salome'
        
        subprocess.Popen([bin_path], shell=use_shell, cwd=working_dir)
        return {"status": "success", "message": f"{tool_name} iniciado!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- ROTAS API ---
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "message": "ProSolve API is running"})

@app.route('/api/scan_workspace', methods=['POST', 'OPTIONS'])
def api_scan_workspace():
    if request.method == 'OPTIONS': return '', 200
    try:
        data = request.get_json()
        folder_path = data.get('folder_path')
        if not folder_path: return jsonify({"status": "error"}), 400
        
        result = scan_workspace(folder_path)
        
        # Trigger automático se houver malhas
        if result.get("Mesh"):
            print("[API] Malha detectada. Iniciando preparacao...")
            success = init_aster_files(folder_path, result["files"]["Mesh"])
            
            if success:
                print("[API] Arquivos prontos. Disparando Wrapper...")
                run_simulation_async(folder_path)
            else:
                print("[API] Falha na preparacao.")

        return jsonify(result), 200
    except Exception as e:
        print(f"[API] Erro no scan: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/launch_tool', methods=['POST'])
def api_launch_tool():
    data = request.get_json()
    tool_name = data.get('tool_name')
    if not tool_name: return jsonify({"status": "error"}), 400
    result = launch_tool(tool_name)
    return jsonify(result)

@app.route('/api/get_logs', methods=['POST'])
def api_get_logs():
    data = request.get_json()
    folder_path = data.get('folder_path')
    if not folder_path: return jsonify({"status": "error"}), 400
    
    # Logs em simulation_files
    aster_log = os.path.join(folder_path, "simulation_files", "message")
    
    combined_logs = ""
    status = "RUNNING" 
    
    if os.path.exists(aster_log):
        try:
            with open(aster_log, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
                combined_logs += "".join(lines[-100:])
                full = "".join(lines)
                if "EXECUTION_CODE_ASTER_EXIT_0000=0" in full: status = "SUCCESS"
                elif "EXIT_STATUS=0" in full: status = "SUCCESS"
                elif "<F>" in full or "FATAL" in full: status = "FAILED"
        except: pass
    else:
        combined_logs = "Waiting for Code_Aster logs..."

    return jsonify({"status": status, "logs": combined_logs})

# --- BROWSE NATIVO ---
class BROWSEINFO(ctypes.Structure):
    _fields_ = [("hwndOwner", wintypes.HWND),("pidlRoot", ctypes.c_void_p),("pszDisplayName", ctypes.c_wchar_p),("lpszTitle", ctypes.c_wchar_p),("ulFlags", wintypes.UINT),("lpfn", ctypes.c_void_p),("lParam", ctypes.c_void_p),("iImage", ctypes.c_int)]

def browse_folder_native():
    try:
        try: ctypes.windll.ole32.CoInitialize(None)
        except: pass
        shell32 = ctypes.windll.shell32
        shell32.SHBrowseForFolderW.restype = ctypes.c_void_p
        shell32.SHBrowseForFolderW.argtypes = [ctypes.POINTER(BROWSEINFO)]
        shell32.SHGetPathFromIDListW.argtypes = [ctypes.c_void_p, ctypes.c_wchar_p]
        ctypes.windll.ole32.CoTaskMemFree.argtypes = [ctypes.c_void_p]
        pidl = 0
        path_buffer = ctypes.create_unicode_buffer(1024)
        bi = BROWSEINFO()
        bi.lpszTitle = "Selecione a Pasta"
        bi.ulFlags = 0x00000001 | 0x00000040 | 0x00000010 
        pidl = shell32.SHBrowseForFolderW(ctypes.byref(bi))
        if pidl:
            success = shell32.SHGetPathFromIDListW(pidl, path_buffer)
            ctypes.windll.ole32.CoTaskMemFree(pidl)
            if success: return os.path.normpath(path_buffer.value)
    except: pass
    return None

@app.route('/api/browse_folder', methods=['POST'])
def api_browse_folder():
    path = browse_folder_native()
    return jsonify({"status": "success", "path": path}) if path else jsonify({"status": "canceled"})




@app.route('/api/read_mesh_groups', methods=['POST'])
def api_read_mesh_groups():
    try:
        data = request.get_json()
        folder_path = data.get('folder_path')
        
        if not folder_path:
            return jsonify({"status": "error", "message": "Path not provided"}), 400
            
        # Caminho exato onde o Code_Aster salvou o arquivo
        json_path = os.path.join(folder_path, "simulation_files", "mesh_groups.json")
        
        if not os.path.exists(json_path):
            return jsonify({"status": "error", "message": "Arquivo mesh_groups.json não encontrado. Rode a malha primeiro."}), 404
            
        with open(json_path, 'r', encoding='utf-8') as f: # utf-8 ou latin-1 dependendo de como foi salvo, json geralmente é utf-8
            content = json.load(f)
            
        return jsonify({"status": "success", "data": content})
        
    except Exception as e:
        print(f"[API] Erro ao ler grupos: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500



@app.route('/api/mesh_dna', methods=['POST'])
def api_mesh_dna():
    """
    Consolidation Protocol Step 1: Serves mesh DNA (topology + normals) to Frontend.
    """
    try:
        data = request.get_json()
        file_path = data.get('file_path')
        if not file_path or not os.path.exists(file_path):
            return jsonify({"status": "error", "message": "Invalid file path"}), 400

        # Build command for modular extractor
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        med_dir = os.path.join(base_dir, "MEDCOUPLING-9.15.0", "MEDCOUPLING-9.15.0")
        extractor = os.path.join(base_dir, "backend", "services", "med", "med_extractor.py")
        
        # Telemetry: Log Port
        port = request.environ.get('SERVER_PORT', '5000')
        print(f"[MED_API] Serving mesh data on Port: {port}")

        # Execute Extractor via Subprocess
        cmd = f'cmd /c "cd /d {med_dir} && call env_launch.bat && python \"{extractor}\" \"{file_path}\""'
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True)

        if result.returncode == 0:
            # Pegar última linha (JSON minificado)
            output = result.stdout.strip().split('\n')[-1]
            extracted_data = json.loads(output)
            
            if extracted_data.get("status") == "success":
                # Telemetry: Log Groups (Protocol)
                groups_found = list(extracted_data.get("data", {}).get("groups", {}).keys())
                print(f"[MED_API] Extracted Groups: {groups_found}")
                return jsonify(extracted_data)
            else:
                return jsonify(extracted_data), 500
        else:
            print(f"[MED_API] Extractor failed: {result.stderr}")
            return jsonify({"status": "error", "message": result.stderr}), 500

    except Exception as e:
        print(f"[MED_API] Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500



def api_calculate_section():
    try:
        # 1. Parse dos Dados
        data = request.get_json()
        stype = data.get('type')
        params = data.get('params', {})
        
        p = {k: float(v) for k, v in params.items() if v}
        
        # Parâmetros de Posição
        off_y = p.get('offset_y', 0.0)
        off_z = p.get('offset_z', 0.0)
        rotation = p.get('rotation', 0.0) # Ângulo em graus
        
        geometry = None
        mesh_size = 10.0 

        # 2. CRIAÇÃO DA GEOMETRIA BASE
        if stype == 'RECTANGLE':
            d, b = p.get('hy', 100), p.get('hz', 50)
            geometry = rectangular_section(d=d, b=b)
            mesh_size = min(d, b) / 5.0
        elif stype == 'BOX':
            d, b, t = p.get('hy', 100), p.get('hz', 50), p.get('t', 5)
            if t*2 >= d or t*2 >= b: t = min(d, b)/2 - 0.1
            geometry = rectangular_hollow_section(d=d, b=b, t=t, r_out=0, n_r=1)
            mesh_size = t / 1.5
        elif stype == 'CIRCLE':
            d = 2 * p.get('r', 50)
            geometry = circular_section(d=d, n=64)
            mesh_size = d / 10.0
        elif stype == 'TUBE':
            d, t = 2 * p.get('r', 50), p.get('t', 5)
            if t*2 >= d: t = d/2 - 0.1
            geometry = circular_hollow_section(d=d, t=t, n=64)
            mesh_size = t / 1.5
        elif stype == 'I_SECTION':
            h = p.get('h', 200)
            bf_t, bf_b = p.get('bf_top', 100), p.get('bf_bot', 100)
            tf_t, tf_b, tw = p.get('tf_top', 10), p.get('tf_bot', 10), p.get('tw', 6)
            if tw >= bf_t: tw = bf_t - 2
            if (tf_t + tf_b) >= h: h = tf_t + tf_b + 10
            geometry = mono_i_section(d=h, b_t=bf_t, b_b=bf_b, t_ft=tf_t, t_fb=tf_b, t_w=tw, r=p.get('r', 0), n_r=8)
            mesh_size = min(tw, tf_t, tf_b) / 1.5
        
        if not geometry:
            return jsonify({"status": "error", "message": "Unknown Geometry"}), 400

        # 3. MANIPULAÇÃO GEOMÉTRICA (FLUXO DE 3 PASSOS)
        
        # PASSO A: RESET (Normalização)
        # O centróide vai para (0,0)
        geometry = geometry.align_center(align_to=(0, 0))
        
        # PASSO B: ROTAÇÃO (Local)
        # Gira em torno do centróide (que agora é 0,0)
        if abs(rotation) > 1e-9:
            # rot_point=(0,0) garante giro no próprio eixo
            geometry = geometry.rotate_section(angle=rotation, rot_point=(0, 0))
        
        # PASSO C: SHIFT (Posicionamento Global)
        # Move do (0,0) para o Offset final
        if abs(off_y) > 1e-9 or abs(off_z) > 1e-9:
            geometry = geometry.shift_section(x_offset=off_z, y_offset=off_y)

        # 4. MALHA E CÁLCULO
        # A malha será criada na posição final (Rotacionada e Deslocada)
        mesh_size = max(mesh_size, 2.0)
        geometry.create_mesh(mesh_sizes=[mesh_size])
        
        sec = Section(geometry)
        
        # Executa as integrais de Elementos Finitos
        # Isso preenche o 'sec.section_props' com os valores reais da malha
        sec.calculate_geometric_properties()
        sec.calculate_warping_properties()
        sec.calculate_plastic_properties()
        
        # 5. EXTRAÇÃO DIRETA (ATRIBUTOS GLOBAIS)
        # Como a malha está na posição final, a integral global É a propriedade nodal (Steiner incluso)
        
        area = sec.section_props.area
        (cx, cy) = sec.get_c() # Centróide final
        
        # Inércias Locais (Centroidais - Já refletem a rotação da peça!)
        (ixx_c, iyy_c, ixy_c) = sec.get_ic()
        
        # Inércias Nodais (Globais em 0,0)
        ixx_frame = sec.section_props.ixx_g
        iyy_frame = sec.section_props.iyy_g
        ixy_frame = sec.section_props.ixy_g
        
        qx_frame = sec.section_props.qx
        qy_frame = sec.section_props.qy

        # Outros
        try:
            (i1, i2) = sec.get_ip()
            theta = sec.get_phi()
        except:
            (i1, i2, theta) = sec.get_ip()
            
        (rx, ry) = sec.get_rc()
        j = sec.get_j()
        gamma = sec.get_gamma()
        (asx, asy) = sec.get_as() 

        z_vals = sec.get_z()
        if len(z_vals) == 4:
            zxx_eff = min(z_vals[0], z_vals[1])
            zyy_eff = min(z_vals[2], z_vals[3])
        else:
             zxx_eff, zyy_eff = z_vals[:2]

        s_vals = sec.get_s()
        sxx, syy = s_vals[:2]

        # 6. RETORNO
        props = {
            "Area (A)": area,
            "Centroid Y (cy)": cy,
            "Centroid Z (cx)": cx,
            "Static Moment Qy (at 0,0)": qx_frame, 
            "Static Moment Qz (at 0,0)": qy_frame,

            # Locais (Relativos ao centróide da peça rotacionada)
            "Iyy (Local)": iyy_c, 
            "Izz (Local)": ixx_c, 
            "Iyz (Local)": ixy_c,
            "I1 (Principal)": i1,
            "I2 (Principal)": i2,
            "Angle (deg)": theta,
            
            # Nodais (Referência absoluta 0,0)
            "Iyy (Node 0,0)": iyy_frame, 
            "Izz (Node 0,0)": ixx_frame,
            "Iyz (Node 0,0)": ixy_frame,

            "Torsion J": j,
            "Warping Iw": gamma,
            "Shear Area Ay": asx, 
            "Shear Area Az": asy,
            
            "Elastic Mod. Wy (Zxx)": zxx_eff,
            "Elastic Mod. Wz (Zyy)": zyy_eff,
            "Plastic Mod. Zy (Sxx)": sxx,
            "Plastic Mod. Zz (Syy)": syy,
            
            "Radius Gyration ry": ry,
            "Radius Gyration rz": rx,
        }

        # 7. IMAGEM
        plt.style.use('default')
        fig, ax = plt.subplots(figsize=(6, 6))
        
        geometry.plot_geometry(ax=ax, cp=False, legend=False, title='')
        
        fig.patch.set_facecolor('white')
        ax.set_facecolor('white')
        ax.axis('on') 
        ax.grid(True, color='#e2e8f0', linestyle='--', linewidth=0.5)
        ax.set_aspect('equal', adjustable='box')
        
        ax.plot(cx, cy, 'r+', markersize=15, markeredgewidth=2, label='Centroid')
        ax.plot(0, 0, 'bx', markersize=12, markeredgewidth=2, label='Node (0,0)')
        
        if abs(cx) > 1e-4 or abs(cy) > 1e-4:
            ax.plot([0, cx], [0, cy], color='red', linestyle=':', linewidth=1.5, label='Offset')
            
        ax.axhline(y=cy, color='#94a3b8', linestyle='-.', linewidth=1) 
        ax.axvline(x=cx, color='#94a3b8', linestyle='-.', linewidth=1)
        ax.axhline(y=0, color='black', linestyle='-', linewidth=0.8, alpha=0.3) 
        ax.axvline(x=0, color='black', linestyle='-', linewidth=0.8, alpha=0.3)

        x_data = [0, cx]; y_data = [0, cy]
        (xmin, xmax, ymin, ymax) = geometry.calculate_extents()
        x_data.extend([xmin, xmax]); y_data.extend([ymin, ymax])
        margin = max(xmax-xmin, ymax-ymin) * 0.2
        if margin == 0: margin = 10
        ax.set_xlim(min(x_data)-margin, max(x_data)+margin)
        ax.set_ylim(min(y_data)-margin, max(y_data)+margin)
        
        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0.05, dpi=120)
        buf.seek(0)
        img_str = base64.b64encode(buf.read()).decode('utf-8')
        plt.close(fig)

        return jsonify({
            "status": "success",
            "properties": props,
            "image": f"data:image/png;base64,{img_str}"
        })

    except Exception as e:
        print(f"Erro SectionCalc: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500



if __name__ == '__main__':
    print("🚀 ProSolve API Server port 5000...")
    app.run(debug=False, host='localhost', port=5000)