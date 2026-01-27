import sys
import os
import json
import inspect

try:
    import MEDLoader as ml
    import medcoupling as mc
except ImportError:
    print("DEBUG: MEDLoader not found")
    sys.exit(1)

def discover_api():
    targets = [
        "ReadFieldNode",
        "ReadFieldCell",
        "ReadFieldGauss",
        "GetFieldIterations",
        "GetFieldNamesOnMesh",
        "GetAllFieldNames"
    ]
    
    discovery = {}
    
    for t in targets:
        if hasattr(ml, t):
            obj = getattr(ml, t)
            discovery[t] = {
                "doc": obj.__doc__ if hasattr(obj, "__doc__") else "No Doc",
                "repr": repr(obj)
            }
        else:
            discovery[t] = "NOT_ATTR"

    # Also inspect a sample Field Iteration object to see how it looks
    target_med = r"C:\Users\jorge\OneDrive\ProSolveSimulation\testcases\shell2\simulation_files\resu.med"
    if os.path.exists(target_med):
        try:
            fields = ml.GetAllFieldNames(target_med)
            if fields:
                iters = ml.GetFieldIterations(fields[0], target_med)
                discovery["sample_iteration"] = {
                    "type": str(type(iters)),
                    "value": str(iters),
                    "dir": dir(iters)[:20]
                }
        except Exception as e:
            discovery["iteration_inspect_error"] = str(e)

    print("__JSON_START__")
    print(json.dumps(discovery, indent=2))
    print("__JSON_END__")

if __name__ == "__main__":
    discover_api()
