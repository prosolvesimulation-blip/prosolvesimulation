import sys
import os
import json

try:
    import MEDLoader as ml
    import medcoupling as mc
except ImportError:
    print("DEBUG: MEDLoader not found")
    sys.exit(1)

def probe_field(file_path):
    results = {}
    try:
        mesh_names = ml.GetMeshNames(file_path)
        mesh_name = mesh_names[0] if mesh_names else "00000001"
        field_names = ml.GetAllFieldNames(file_path)
        
        depl_field = next((f for f in field_names if "DEPL" in f), None)
        if depl_field:
            f_obj = ml.ReadFieldNode(file_path, mesh_name, 0, depl_field, 1, 1)
            results["field_name"] = depl_field
            results["num_components"] = f_obj.getNumberOfComponents()
            results["component_names"] = f_obj.getComponentsNames()
            results["num_values"] = f_obj.getArray().getNumberOfTuples()
        else:
            results["error"] = "DEPL field not found"

    except Exception as e:
        results["error"] = str(e)

    print("__JSON_START__")
    print(json.dumps(results))
    print("__JSON_END__")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        probe_field(sys.argv[1])
