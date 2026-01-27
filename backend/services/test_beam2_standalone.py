
import sys
import os
import json

# Adjust path to find services
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.med.vtk_extruder import med_to_vtk_pipeline

# Test File (Beam2)
TEST_MED = r"c:\Users\jorge\OneDrive\ProSolveSimulation\testcases\Beam2\beam.med"

def run_test():
    print(f"--- 3D Standalone Test: {TEST_MED} ---")
    
    if not os.path.exists(TEST_MED):
        print(f"ERROR: File not found at {TEST_MED}")
        return

    # Simulate Frontend Geometry State (Beam2 case)
    # Target group: 'Group_1' (based on user image)
    mock_geometries = [
        {
            "group": "Group_1",
            "_category": "1D",
            "section_type": "I_SECTION",
            "section_params": {
                "offset_y": -100.0,
                "offset_z": 0.0
            },
            "section_mesh": { 
                "vertices": [[-100, 0], [100, 0], [100, 200], [-100, 200]],
                "triangles": [[0, 1, 2], [0, 2, 3]]
            }
        }
    ]
    
    print("[TEST] Triggering med_to_vtk_pipeline...")
    res = med_to_vtk_pipeline(TEST_MED, geometries=mock_geometries)
    
    if res.get("status") == "success":
        print("SUCCESS: 3D Data generated.")
        print(f"Groups processed: {list(res['cells'].keys())}")
        
        # Check if EXTRUSION exists
        if "Group_1_EXTRUSION" in res["cells"]:
            ext_data = res["cells"]["Group_1_EXTRUSION"]
            print(f"Extrusion check: type={ext_data['type']}, is_extruded={ext_data['is_extruded']}")
        else:
            print("WARNING: 'Group_1_EXTRUSION' not found in output.")
            
    else:
        print("FAILURE:", res)

if __name__ == "__main__":
    run_test()
