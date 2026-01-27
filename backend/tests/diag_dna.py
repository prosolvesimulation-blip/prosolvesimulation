import sys
import os
import json

# Path setup to import the extractor from the project
sys.path.append(os.path.abspath(os.path.join(os.getcwd(), "backend", "services", "med")))

try:
    from med_extractor import extract_med_data
    
    # Target test file from the user's project
    test_file = r"c:\Users\jorge\OneDrive\ProSolveSimulation\testcases\shell2\shell.med"
    
    if not os.path.exists(test_file):
        print(f"ERROR: Test file not found at {test_file}")
        sys.exit(1)
        
    print(f"INVESTIGATION: Analyzing {test_file} output...")
    result = extract_med_data(test_file)
    
    if result["status"] == "success":
        groups = result["data"]["groups"]
        print("\n=== DATA STRUCTURE AUDIT ===")
        for name, info in groups.items():
            print(f"\nGroup: {name}")
            print(f" - Fields available: {list(info.keys())}")
            if "types" in info:
                print(f" - DNA Types found: {info['types']}")
            else:
                print(" - DNA Types: NOT FOUND in payload. Only generic data available.")
    else:
        print(f"ERROR: Extraction returned status: {result.get('status')} - {result.get('message')}")

except ImportError as e:
    print(f"ERROR: Failed to import med_extractor. Ensure CWD is project root. Error: {e}")
except Exception as e:
    print(f"CRITICAL: {e}")
