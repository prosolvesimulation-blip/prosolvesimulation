import sys
import os
import json
import traceback

# ==============================================================================
# MED_ANALYSIS_SERVICE.PY - Dedicated for Post-Processing Analysis Tab
# Goal: Provide an isolated, high-fidelity pipeline for simulation results.
# Reconstructs HQ Geometry + Physics Scalars/Vectors in a single context.
# ==============================================================================

try:
    import MEDLoader as ml
    import medcoupling as mc
    import numpy as np
except ImportError:
    ml = None
    mc = None
    np = None

try:
    import vtk
    from vtk.util import numpy_support
except ImportError:
    vtk = None

# --- GEOMETRY UTILS ---

def map_med_to_vtk_protocol(mc_type):
    """Rigorous mapping to VTK cell types."""
    mapping = {
        mc.NORM_SEG2: 3,   # VTK_LINE
        mc.NORM_TRI3: 5,   # VTK_TRIANGLE
        mc.NORM_QUAD4: 9,  # VTK_QUAD
        mc.NORM_TETRA4: 10, # VTK_TETRA
        mc.NORM_HEXA8: 12  # VTK_HEXAHEDRON
    }
    return mapping.get(mc_type, 0)

def process_connectivity(raw_conn_flat, num_cells):
    """
    🕸️ SPIDERWEB FIX: Cleans connectivity by removing size/type prefixes.
    Ensures the VTK viewer receives pure point indices.
    """
    if num_cells <= 0 or not raw_conn_flat:
        return []
    total_len = len(raw_conn_flat)
    nodes_per_elem_total = total_len // num_cells
    cleaned_connectivity = []
    for i in range(num_cells):
        chunk = raw_conn_flat[i * nodes_per_elem_total : (i + 1) * nodes_per_elem_total]
        if len(chunk) > 1:
            cleaned_connectivity.append(chunk[1:]) 
        else:
            cleaned_connectivity.append(chunk)
    return cleaned_connectivity

# --- PHYSICS UTILS ---

def generate_vectors(points, field_data, nb_comp):
    """
    VTK 'Generate Vectors' implementation.
    Converts 6-comp DEPL to standard 3D Vector field for warping.
    """
    if vtk is None: return field_data
    try:
        pd = vtk.vtkPolyData()
        pts = vtk.vtkPoints()
        pts.SetData(numpy_support.numpy_to_vtk(np.array(points).reshape(-1, 3)))
        pd.SetPoints(pts)
        
        raw_arr = numpy_support.numpy_to_vtk(np.array(field_data).reshape(-1, nb_comp))
        raw_arr.SetName("DISPLACEMENT_RAW")
        pd.GetPointData().AddArray(raw_arr)
        
        calc = vtk.vtkArrayCalculator()
        calc.SetInputData(pd)
        calc.AddScalarVariable("dx", "DISPLACEMENT_RAW", 0)
        calc.AddScalarVariable("dy", "DISPLACEMENT_RAW", 1)
        calc.AddScalarVariable("dz", "DISPLACEMENT_RAW", 2)
        calc.SetFunction("dx*iHat + dy*jHat + dz*kHat")
        calc.SetResultArrayName("DISPLACEMENT_VEC")
        calc.Update()
        
        res_pd = calc.GetOutput()
        vec_arr = res_pd.GetPointData().GetArray("DISPLACEMENT_VEC")
        return numpy_support.vtk_to_numpy(vec_arr).flatten().tolist()
    except Exception as e:
        sys.stderr.write(f"Generate Vectors failed: {e}\n")
        return field_data

# --- COMMAND HANDLERS ---

def get_analysis_dna(file_path):
    """Extracts base mesh with structured connectivity for the Analysis Tab."""
    if not os.path.exists(file_path): return {"status": "error", "message": "File not found"}
    try:
        mesh_names = ml.GetMeshNames(file_path)
        if not mesh_names: return {"status": "error", "message": "No mesh"}
        mesh_name = mesh_names[0]
        
        # We focus on the FULL MESH for analysis
        full_mesh = ml.ReadUMeshFromFile(file_path, mesh_name, 0)
        num_cells = full_mesh.getNumberOfCells()
        coords = full_mesh.getCoords().toNumPyArray().flatten().tolist()
        
        conn_obj = full_mesh.getNodalConnectivity()
        raw_flat = conn_obj.toNumPyArray().flatten().tolist()
        connectivity = process_connectivity(raw_flat, num_cells)
        
        vtk_type = map_med_to_vtk_protocol(full_mesh.getTypeOfCell(0))

        return {
            "status": "success",
            "data": {
                "groups": {
                    "_FULL_MESH_": {
                        "points": coords,
                        "connectivity": connectivity,
                        "num_elements": int(num_cells),
                        "vtk_type": int(vtk_type)
                    }
                }
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

def get_analysis_meta(file_path):
    """Lists available fields and timesteps for the Analysis selector."""
    if not ml: return {"status": "error", "message": "MEDCoupling Not Found"}
    try:
        sys.stderr.write(f"[Analysis] Loading Meta from: {os.path.basename(file_path)}\n")
        mesh_names = ml.GetMeshNames(file_path)
        mesh_name = mesh_names[0] if mesh_names else "00000001"
        field_names = ml.GetAllFieldNames(file_path)
        sys.stderr.write(f"[Analysis] Found Fields: {field_names}\n")
        
        meta = {}
        for fn in field_names:
            try:
                # Try discovery on nodes or cells
                ts = []
                try:
                    ts = ml.GetFieldIterations(ml.ON_NODES, file_path, mesh_name, fn)
                except:
                    ts = ml.GetFieldIterations(ml.ON_CELLS, file_path, mesh_name, fn)
                meta[fn] = ts
            except:
                meta[fn] = []
        return {"status": "success", "fields": meta, "mesh_name": mesh_name}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def get_field_data(file_path, field_mode, step_idx=0):
    """
    Extracts specific field data (Deformation or Stress) for Analysis.
    Returns: { status: "success", data: [...], location: "node"|"cell" }
    """
    try:
        sys.stderr.write(f"[Analysis] Requesting Field: {field_mode} Step: {step_idx}\n")
        mesh_names = ml.GetMeshNames(file_path)
        mesh_name = mesh_names[0] if mesh_names else "00000001"
        
        # 1. DEPL Extraction (Vectorized)
        if field_mode == "--depl":
            field_names = ml.GetAllFieldNames(file_path)
            depl_fn = next((f for f in field_names if "DEPL" in f), None)
            if not depl_fn: return {"status": "error", "message": "DEPL Not Found"}
            
            f_obj = ml.ReadFieldNode(file_path, mesh_name, 0, depl_fn, 1, 1)
            arr_obj = f_obj.getArray()
            nb_comp = arr_obj.getNumberOfComponents()
            raw_data = arr_obj.toNumPyArray().flatten().tolist()
            
            # Use VTK Vector Gen
            coords = ml.ReadUMeshFromFile(file_path, mesh_name, 0).getCoords().toNumPyArray().flatten().tolist()
            v_data = generate_vectors(coords, raw_data, nb_comp)
            # Ensure pure float
            v_data = [float(x) for x in v_data]
            sys.stderr.write(f"[Analysis] Vectors Generated: {len(v_data)//3} points\n")
            return {"status": "success", "data": v_data, "location": "node"}

        # 2. Stress/Mises Extraction (Scalarized)
        else:
            f_obj = None
            location = "node"
            try:
                f_obj = ml.ReadFieldNode(file_path, mesh_name, 0, field_mode, 1, 1)
                location = "node"
            except:
                try:
                    f_obj = ml.ReadFieldCell(file_path, mesh_name, 0, field_mode, 1, 1)
                    location = "cell"
                except: pass
            
            if not f_obj: return {"status": "error", "message": f"Field {field_mode} Not Found"}
            
            arr_obj = f_obj.getArray()
            # Professional Scalarization
            if arr_obj.getNumberOfComponents() > 1:
                sys.stderr.write(f"[Analysis] Scalarizing {field_mode}: {arr_obj.getNumberOfComponents()} -> 1\n")
                arr_obj = arr_obj.keepSelectedComponents([0])
            
            data_np = arr_obj.toNumPyArray().flatten()
            data = [float(x) for x in data_np.tolist()]
            
            # Audit Stats
            d_min, d_max = float(np.min(data_np)), float(np.max(data_np))
            sys.stderr.write(f"[Analysis] Result Audit: Min={d_min:.4f}, Max={d_max:.4f}, Loc={location}, Count={len(data)}\n")
            
            return {"status": "success", "data": data, "location": location}
            
    except Exception as e:
        sys.stderr.write(f"[Analysis] Field Data Error: {e}\n")
        return {"status": "error", "message": str(e)}

def get_analysis_context(file_path, field_mode):
    """
    ULTIMATE PARA-VIEW BRIDGE: Returns Geometry and Physics in ONE single delivery.
    """
    try:
        dna = get_analysis_dna(file_path)
        if dna.get("status") != "success": return dna
        
        field = get_field_data(file_path, field_mode)
        if field.get("status") != "success": return field
        
        # Build Context
        context = {
            "status": "success",
            "mesh": dna["data"]["groups"]["_FULL_MESH_"],
            "physics": {
                "field_name": field_mode,
                "data": field["data"],
                "location": field["location"]
            }
        }
        return context
    except Exception as e:
        return {"status": "error", "message": f"Context generation failed: {e}"}

# --- ENTRY POINT ---

if __name__ == "__main__":
    if len(sys.argv) < 3: sys.exit(1)
    
    cmd = sys.argv[1] # --dna, --meta, --depl, VM_...
    target_med = sys.argv[2]
    
    if cmd == "--dna":
        res = get_analysis_dna(target_med)
    elif cmd == "--meta":
        res = get_analysis_meta(target_med)
    elif cmd == "--depl":
        res = get_field_data(target_med, "--depl")
    elif cmd.startswith("--context:"):
        field_target = cmd.split("--context:")[1]
        res = get_analysis_context(target_med, field_target)
    else:
        # Explicit field name (Legacy compatibility)
        res = get_field_data(target_med, cmd)

    sys.stdout.write("__JSON_START__")
    sys.stdout.write(json.dumps(res))
    sys.stdout.write("__JSON_END__")
