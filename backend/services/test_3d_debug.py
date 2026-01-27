
import sys
import os
import json

# Adjust path to find services
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.med.vtk_extruder import med_to_vtk_pipeline

# Test File (Beam)
TEST_MED = r"c:\Users\jorge\OneDrive\ProSolveSimulation\testcases\beam\beam.med"

def run_test():
    print(f"--- 3D Pipeline Delivery Test: {TEST_MED} ---")
    
    # Simulate Frontend Geometry State (Beam with section)
    # The group name in beam.med is 'I300x200x10x10' based on previous logs
    mock_geometries = [
        {
            "group": "I300x200x10x10",
            "_category": "1D",
            "section_data": { # The 2D Mesh from sectionproperties/state
                "vertices": [[0, 0], [10, 0], [10, 10], [0, 10]],
                "triangles": [[0, 1, 2], [0, 2, 3]]
            }
        }
    ]
    
    print("[TEST] Triggering med_to_vtk_pipeline with mock geometries...")
    res = med_to_vtk_pipeline(TEST_MED, geometries=mock_geometries)
    
    if res.get("status") == "success":
        print("SUCCESS: 3D Data generated.")
    else:
        print("FAILURE:", res)

if __name__ == "__main__":
    run_test()
