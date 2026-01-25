import sys
import os
import json

# Add backend directory to path
backend_dir = os.path.join(os.getcwd(), "backend")
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from services.vtk_converter import med_to_vtk_json

def verify_modular_system():
    base_dir = r"c:\Users\jorge\OneDrive\ProSolveSimulation"
    shell_med = os.path.join(base_dir, "testcases", "shell", "shell.med")
    
    # Mock Geometries
    mock_geos = [
        {"group": "group_shell", "type": "COQUE_3D", "section_params": {"thickness": 10.0, "offset": 5.0}, "_category": "2D"},
        {"group": "group_beam", "type": "POU_D_T", "section_params": {"radius": 0.5}, "_category": "1D"}
    ]
    
    print("\n--- STARTING MODULAR VTK VERIFICATION ---")
    print(f"File: {shell_med}")
    
    result = med_to_vtk_json(shell_med, mock_geos)
    
    if result["status"] == "success":
        print("\nSUCCESS: Backend returned data!")
        print(f"Points: {result.get('num_points')}")
        cells = result.get("cells", {})
        print(f"Groups processed: {list(cells.keys())}")
        
        for g_name, g_data in cells.items():
            is_ext = g_data.get("is_extruded", False)
            c_type = g_data.get("type")
            count = len(g_data.get("connectivity", []))
            print(f"  -> Group '{g_name}': {count} cells, type '{c_type}', Extruded: {is_ext}")
            
            if is_ext:
                print(f"     PASSED: Extrusion verified for '{g_name}'")
    else:
        print("\nFAILED: Backend returned error.")
        print(f"Message: {result.get('message')}")
        if "traceback" in result: print(result["traceback"])

if __name__ == "__main__":
    verify_modular_system()
