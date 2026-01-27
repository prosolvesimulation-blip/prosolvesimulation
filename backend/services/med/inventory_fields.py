import sys
import os
import json

try:
    import MEDLoader as ml
    import medcoupling as mc
except ImportError:
    sys.exit(1)

def inventory(file_path):
    results = {}
    try:
        mesh_names = ml.GetMeshNames(file_path)
        mesh_name = mesh_names[0] if mesh_names else "00000001"
        field_names = ml.GetAllFieldNames(file_path)
        
        for fn in field_names:
            try:
                # Test node then cell
                f_obj = None
                try:
                    f_obj = ml.ReadFieldNode(file_path, mesh_name, 0, fn, 1, 1)
                except:
                    f_obj = ml.ReadFieldCell(file_path, mesh_name, 0, fn, 1, 1)
                
                if f_obj:
                    results[fn] = {
                        "nb_comp": f_obj.getNumberOfComponents(),
                        "nb_tuples": f_obj.getArray().getNumberOfTuples()
                    }
            except: pass

    except Exception as e:
        results["error"] = str(e)

    print("__JSON_START__")
    print(json.dumps(results))
    print("__JSON_END__")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        inventory(sys.argv[1])
