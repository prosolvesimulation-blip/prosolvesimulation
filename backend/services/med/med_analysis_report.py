import sys
import os
import json
import traceback

# ==============================================================================
# MED_ANALYSIS_REPORT.PY - DEDICATED EXTRACTOR
# Focus: High-Fidelity Data Extraction from resu.med using MEDCOUPLING.
# Output: Standard raw data arrays for geometry and physics.
# ==============================================================================

try:
    import MEDLoader as ml
    import medcoupling as mc
    import numpy as np
except ImportError:
    ml = None
    mc = None
    np = None

def get_mesh_report(file_path):
    """Extracts mesh data in a format suitable for VTK construction."""
    if not os.path.exists(file_path): return {"status": "error", "message": "File not found"}
    try:
        mesh_names = ml.GetMeshNames(file_path)
        if not mesh_names: return {"status": "error", "message": "No meshes found"}
        mesh_name = mesh_names[0]
        
        full_mesh = ml.ReadUMeshFromFile(file_path, mesh_name, 0)
        num_cells = full_mesh.getNumberOfCells()
        coords = full_mesh.getCoords().toNumPyArray().flatten().tolist()
        
        # Connectivity (Raw for transfer, will be structured by processor)
        conn = full_mesh.getNodalConnectivity().toNumPyArray().flatten().tolist()
        cell_types = [full_mesh.getTypeOfCell(i) for i in range(min(num_cells, 100))] # Sample
        
        return {
            "status": "success",
            "type": "mesh",
            "data": {
                "points": [float(x) for x in coords],
                "connectivity": conn,
                "num_elements": int(num_cells),
                "med_cell_type": int(full_mesh.getTypeOfCell(0))
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e), "traceback": traceback.format_exc()}

def get_field_report(file_path, field_name, step_idx=0):
    """Extracts field data (Scalars or Vectors) from resu.med."""
    try:
        mesh_names = ml.GetMeshNames(file_path)
        mesh_name = mesh_names[0] if mesh_names else "00000001"
        
        # Determine if field is Node or Cell based
        f_obj = None
        location = "node"
        try:
            f_obj = ml.ReadFieldNode(file_path, mesh_name, 0, field_name, 1, 1)
            location = "node"
        except:
            f_obj = ml.ReadFieldCell(file_path, mesh_name, 0, field_name, 1, 1)
            location = "cell"
            
        arr = f_obj.getArray()
        nb_comp = arr.getNumberOfComponents()
        data = arr.toNumPyArray().flatten().tolist()
        
        return {
            "status": "success",
            "type": "field",
            "data": {
                "name": field_name,
                "values": [float(x) for x in data],
                "nb_comp": int(nb_comp),
                "location": location
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

def get_metadata(file_path):
    """Discovery service for the Analysis report."""
    try:
        mesh_names = ml.GetMeshNames(file_path)
        mesh_name = mesh_names[0] if mesh_names else "00000001"
        field_names = ml.GetAllFieldNames(file_path)
        
        meta = {}
        for fn in field_names:
            try:
                ts = []
                try: ts = ml.GetFieldIterations(ml.ON_NODES, file_path, mesh_name, fn)
                except: ts = ml.GetFieldIterations(ml.ON_CELLS, file_path, mesh_name, fn)
                meta[fn] = ts
            except: meta[fn] = []
        return {"status": "success", "type": "meta", "fields": meta}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 3: sys.exit(1)
    
    cmd = sys.argv[1]
    path = sys.argv[2]
    
    if cmd == "--mesh": res = get_mesh_report(path)
    elif cmd == "--meta": res = get_metadata(path)
    else: res = get_field_report(path, cmd) # Command is field name
    
    sys.stdout.write("__JSON_START__")
    sys.stdout.write(json.dumps(res))
    sys.stdout.write("__JSON_END__")
