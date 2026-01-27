import sys
import os
import json

try:
    import MEDLoader as ml
except ImportError:
    sys.exit(1)

def probe_detail(file_path):
    results = {}
    try:
        mesh_names = ml.GetMeshNames(file_path)
        mesh_name = mesh_names[0] if mesh_names else "00000001"
        field_names = ml.GetAllFieldNames(file_path)
        
        for fn in field_names:
            if "VM" in fn or "SIGM" in f:
                 try:
                    f_obj = None
                    try:
                        f_obj = ml.ReadFieldNode(file_path, mesh_name, 0, fn, 1, 1)
                    except:
                        f_obj = ml.ReadFieldCell(file_path, mesh_name, 0, fn, 1, 1)
                    
                    if f_obj:
                        # getComponentsNames is not in this version likely (from previous error)
                        # Let's try to get them via MEDFileField component info
                        # Actually, let's just dump the first tuple to see values
                        arr = f_obj.getArray().toNumPyArray()
                        results[fn] = {
                            "nb_comp": f_obj.getNumberOfComponents(),
                            "sample": arr[0].tolist()
                        }
                 except: pass

    except Exception as e:
        results["error"] = str(e)

    print("__JSON_START__")
    print(json.dumps(results))
    print("__JSON_END__")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        probe_detail(sys.argv[1])
