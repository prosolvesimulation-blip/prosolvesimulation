import sys
import os
import json

# ==============================================================================
# MED_INSPECTER.PY - STANDALONE INSPECTION TOOL
# Objetivo: Identificar explicitamente o tipo de elemento (SEG2, QUAD4, etc)
# para cada grupo em um arquivo MED.
# ==============================================================================

try:
    import MEDLoader as ml
    import medcoupling as mc
    import numpy as np
except ImportError:
    # Error handling for environments without MEDCoupling
    ml = None
    mc = None

def get_med_type_name(mc_type):
    """Retorna o nome amigável do tipo de elemento MED."""
    if mc is None:
        return f"Unknown({mc_type})"
        
    mapping = {
        mc.NORM_SEG2: "SEG2",
        mc.NORM_TRI3: "TRI3",
        mc.NORM_QUAD4: "QUAD4",
        mc.NORM_TETRA4: "TETRA4",
        mc.NORM_HEXA8: "HEXA8",
        mc.NORM_PENTA6: "PENTA6",
        mc.NORM_PYRA5: "PYRA5",
        # Tipos de ordem superior se necessário
        mc.NORM_SEG3: "SEG3",
        mc.NORM_TRI6: "TRI6",
        mc.NORM_QUAD8: "QUAD8"
    }
    return mapping.get(mc_type, f"OTHER({mc_type})")

def inspect_med_groups(file_path):
    """
    Inspeciona o arquivo MED e retorna um dicionário com os tipos de cada grupo.
    """
    if not os.path.exists(file_path):
        return {"status": "error", "message": f"File not found: {file_path}"}
        
    if ml is None or mc is None:
        return {"status": "error", "message": "MEDCoupling environment not found."}

    try:
        mesh_names = ml.GetMeshNames(file_path)
        if not mesh_names:
            return {"status": "error", "message": "No meshes found in MED file."}
        
        mesh_name = mesh_names[0]
        group_names = ml.GetMeshGroupsNames(file_path, mesh_name)
        
        inspection_results = {
            "mesh_name": mesh_name,
            "groups": {}
        }

        for g_name in group_names:
            try:
                # Carrega a malha do grupo para inspeção
                sub_mesh = ml.ReadUMeshFromGroups(file_path, mesh_name, 0, [g_name])
                num_cells = sub_mesh.getNumberOfCells()
                
                if num_cells > 0:
                    # Pega o tipo do primeiro elemento (assumindo grupos homogêneos)
                    mc_type = sub_mesh.getTypeOfCell(0)
                    type_name = get_med_type_name(mc_type)
                    dim = sub_mesh.getMeshDimension()
                    
                    inspection_results["groups"][g_name] = {
                        "med_type": type_name,
                        "cell_count": int(num_cells),
                        "dimension": int(dim)
                    }
                else:
                    inspection_results["groups"][g_name] = {
                        "med_type": "EMPTY/NODE_GROUP",
                        "cell_count": 0
                    }
            except Exception as e:
                inspection_results["groups"][g_name] = {
                    "med_type": "ERROR",
                    "error": str(e)
                }

        return {
            "status": "success",
            "filename": os.path.basename(file_path),
            "data": inspection_results
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python med_inspecter.py <path_to_med>")
        sys.exit(1)
    
    input_med = sys.argv[1]
    result = inspect_med_groups(input_med)
    
    # 1. ALWAYS emit JSON for the pipeline
    sys.stdout.write("__JSON_START__")
    sys.stdout.write(json.dumps(result, separators=(',', ':')))
    sys.stdout.write("__JSON_END__")
    
    # 2. Human readable for manual inspection (optional, but keep it clean)
    if result["status"] == "success":
        data = result["data"]
        # Use stderr or just a header to separate from JSON if needed, 
        # but med_env_run will ignore it because it looks for markers.
        print(f"\n\n--- INTERACTIVE INSPECTION: {os.path.basename(input_med)} ---")
        print(f"Mesh detected: {data['mesh_name']}\n")
        print(f"{'GROUP NAME':<30} | {'TYPE':<10} | {'COUNT':<10} | {'DIM'}")
        print("-" * 65)
        for g_name, info in data["groups"].items():
            t = info.get("med_type", "N/A")
            c = info.get("cell_count", 0)
            d = info.get("dimension", "-")
            print(f"{g_name:<30} | {t:<10} | {c:<10} | {d}")
    else:
        print(f"ERROR: {result['message']}")
