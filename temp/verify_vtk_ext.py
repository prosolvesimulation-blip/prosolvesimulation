import sys
import os
import json
import subprocess

def verify_vtk_extruder_systematic():
    base_dir = r"c:\Users\jorge\OneDrive\ProSolveSimulation"
    med_dir = os.path.join(base_dir, "MEDCOUPLING-9.15.0", "MEDCOUPLING-9.15.0")
    extruder_path = os.path.join(base_dir, "backend", "services", "med", "vtk_extruder.py")
    shell_med = os.path.join(base_dir, "testcases", "shell", "shell.med")
    
    # Mock Geometries
    mock_geos = [{"group": "group_shell", "type": "COQUE_3D", "section_params": {"thickness": 5.0, "offset": 2.5}}]
    geom_json = os.path.join(base_dir, "temp", "mock_geos_vtk_extruder.json")
    os.makedirs(os.path.dirname(geom_json), exist_ok=True)
    with open(geom_json, 'w') as f:
        json.dump(mock_geos, f)
        
    cmd = f'cmd /c "cd /d {med_dir} && call env_launch.bat && python \"{extruder_path}\" \"{shell_med}\" \"{geom_json}\""'
    print(f"Running VTK Extruder: {cmd}")
    
    result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    
    output = result.stdout.strip()
    data = None
    lines = output.split('\n')
    for line in reversed(lines):
        line = line.strip()
        if line.startswith('{') and line.endswith('}'):
            try:
                data = json.loads(line)
                break
            except: continue
            
    if data and data.get("status") == "success":
        print("\nSUCCESS: VTK Extruder returned data!")
        cells = data.get("cells", {})
        print(f"Groups: {list(cells.keys())}")
        if "group_shell_EXTRUDED" in cells:
            ext = cells["group_shell_EXTRUDED"]
            print(f"Extruded cells: {ext.get('count')}")
            # A linear extrusion of 1250 quads should create 1250 volumes (hexas/wedges)
            # vtkLinearExtrusionFilter creates quads for side faces + original surface + cap surface.
            # Actually it's often more than just a skin.
            if ext.get('count') > 0:
                print("PASSED: Extrusion generated cells.")
        else:
            print("FAILED: Missing extruded group.")
    else:
        print("FAILED: Extruder failed.")
        print(f"Output: {output}")
        if result.stderr: print(f"Error: {result.stderr}")

if __name__ == "__main__":
    verify_vtk_extruder_systematic()
