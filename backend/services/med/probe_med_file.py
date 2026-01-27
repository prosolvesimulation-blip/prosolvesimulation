import sys
import os
import json

try:
    import MEDLoader as ml
    import medcoupling as mc
except ImportError:
    print("DEBUG: MEDLoader not found")
    sys.exit(1)

def probe(file_path):
    results = {}
    try:
        # 1. Mesh Check
        mesh_names = ml.GetMeshNames(file_path)
        results["meshes"] = mesh_names
        mesh_name = mesh_names[0] if mesh_names else "00000001"

        # 2. Confirmed Field Discovery Methods
        try:
            results["GetAllFieldNames"] = ml.GetAllFieldNames(file_path)
        except Exception as e:
            results["GetAllFieldNames_Error"] = str(e)

        try:
            results["GetFieldNamesOnMesh"] = ml.GetFieldNamesOnMesh(file_path, mesh_name)
        except Exception as e:
            results["GetFieldNamesOnMesh_Error"] = str(e)
            
        try:
            results["GetNodeFieldNamesOnMesh"] = ml.GetNodeFieldNamesOnMesh(file_path, mesh_name)
        except Exception as e:
            results["GetNodeFieldNamesOnMesh_Error"] = str(e)

        try:
            results["GetCellFieldNamesOnMesh"] = ml.GetCellFieldNamesOnMesh(file_path, mesh_name)
        except Exception as e:
            results["GetCellFieldNamesOnMesh_Error"] = str(e)

    except Exception as e:
        results["Global_Error"] = str(e)

    print("__JSON_START__")
    print(json.dumps(results))
    print("__JSON_END__")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        probe(sys.argv[1])
