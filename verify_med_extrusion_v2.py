import sys
import os
import json
import subprocess

def verify():
    base_dir = r"c:\Users\jorge\OneDrive\ProSolveSimulation"
    med_dir = os.path.join(base_dir, "MEDCOUPLING-9.15.0", "MEDCOUPLING-9.15.0")
    extractor_path = os.path.join(base_dir, "backend", "services", "med_extractor.py")
    shell_med = os.path.join(base_dir, "testcases", "shell", "shell.med")
    
    # 1. Create temporary geometries JSON
    geometries = [
        {
            "group": "group_shell",
            "type": "COQUE_3D",
            "section_params": {
                "thickness": 10.0,
                "offset": 0.0
            }
        }
    ]
    
    geom_json_path = os.path.join(base_dir, "temp", "geometries_verify_v2.json")
    os.makedirs(os.path.dirname(geom_json_path), exist_ok=True)
    with open(geom_json_path, 'w') as f:
        json.dump(geometries, f)
        
    print(f"Testing extrusion with {shell_med}")
    
    # 2. Call extractor
    cmd = f'cmd /c "cd /d {med_dir} && call env_launch.bat && python {extractor_path} \"{shell_med}\" \"{geom_json_path}\""'
    result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    
    if result.stderr:
        print("--- STDERR ---")
        print(result.stderr)
        print("--------------")

    # 3. Parse output
    output = result.stdout.strip()
    lines = output.split('\n')
    data = None
    for line in reversed(lines):
        line = line.strip()
        if line.startswith('{') and line.endswith('}'):
            try:
                data = json.loads(line)
                break
            except: continue
            
    if not data:
        print("FAILED: No JSON found in output")
        return
        
    # 4. Assertions
    cells = data.get("cells", {})
    print(f"Groups found: {list(cells.keys())}")
    
    if "group_shell_EXTRUDED" in cells:
        ext_data = cells["group_shell_EXTRUDED"]
        print(f"SUCCESS: 'group_shell_EXTRUDED' found!")
        print(f"  - Type: {ext_data.get('type')} (Expected: quad/triangle)")
        print(f"  - Cell count: {ext_data.get('count')}")
        
        # Check coordinates length to see if points were accumulated correctly
        points = data.get("points", [])
        print(f"Total points in master list: {len(points)}")
        
        # Verify first connectivity of a non-extruded group to see if offset is correct
        if "Group_Of_All_Faces" in cells:
            f_conn = cells["Group_Of_All_Faces"]["connectivity"][0]
            print(f"Sample Face Connectivity: {f_conn}")
            # If offset bug is fixed, points should be within range of that group's points
    else:
        print("FAILED: 'group_shell_EXTRUDED' not found in result.")

if __name__ == "__main__":
    verify()
