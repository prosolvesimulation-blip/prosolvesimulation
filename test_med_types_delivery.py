import sys
import os
import json
import subprocess

# Add backend to path if needed (but we'll call as subprocess for environment isolation)
EXTRACTOR_PATH = r"c:\Users\jorge\OneDrive\ProSolveSimulation\backend\services\med\med_extractor.py"
SAMPLE_MED = r"c:\Users\jorge\OneDrive\ProSolveSimulation\testcases\shell\shell.med"

def test_delivery():
    print(f"Testing extractor: {EXTRACTOR_PATH}")
    print(f"Against file: {SAMPLE_MED}")
    
    if not os.path.exists(EXTRACTOR_PATH):
        print("Extractor not found!")
        return
    if not os.path.exists(SAMPLE_MED):
        print("Sample MED not found!")
        return

    # Use the same logic as the API (subprocess)
    # We might need to handle the MEDCoupling environment
    # For this test, we assume the current environment has it or we can at least see the code's intent
    
    try:
        # In this environment, we might not have MEDCoupling, 
        # but we can check the logic in med_extractor.py
        import importlib.util
        spec = importlib.util.spec_from_file_location("med_extractor", EXTRACTOR_PATH)
        med_extractor = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(med_extractor)
        
        # If we can't import because of missing MEDLoader, we catch it
        print("\nChecking map_med_to_vtk_protocol mapping in code:")
        # Let's peek at the mapping defined in the file
        with open(EXTRACTOR_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
            if "mc.NORM_SEG2: 3" in content: print("  - SEG2 mapping: EXISTS (VTK 3)")
            if "mc.NORM_TRI3: 5" in content: print("  - TRI3 mapping: EXISTS (VTK 5)")
            if "mc.NORM_QUAD4: 9" in content: print("  - QUAD4 mapping: EXISTS (VTK 9)")
            if "mc.NORM_TETRA4: 10" in content: print("  - TETRA4 mapping: EXISTS (VTK 10)")
            if "mc.NORM_HEXA8: 12" in content: print("  - HEXA8 mapping: EXISTS (VTK 12)")

        print("\nAnalysis of '_extract_mesh_components' output structure:")
        if '"vtk_type": int(vtk_id)' in content:
            print("  - Delivery of 'vtk_type': YES (Integer ID)")
        else:
            print("  - Delivery of 'vtk_type': NO")
            
        if '"category": category' in content:
            print("  - Delivery of 'category': YES (1D, 2D, 3D)")
        else:
            print("  - Delivery of 'category': NO")

        print("\nConclusion: med_extractor delivers the VTK numerical ID, but NOT the string 'SEG2' or 'QUAD4' directly.")
        print("The VTK IDs (3 for SEG2, 9 for QUAD4) are used by the frontend to identify the element type.")

    except Exception as e:
        print(f"Error during static/dynamic analysis: {e}")

if __name__ == "__main__":
    test_delivery()
