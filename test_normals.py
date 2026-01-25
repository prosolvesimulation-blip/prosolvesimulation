import subprocess
import json

med_dir = r"c:\Users\jorge\OneDrive\ProSolveSimulation\MEDCOUPLING-9.15.0\MEDCOUPLING-9.15.0"
extractor = r"c:\Users\jorge\OneDrive\ProSolveSimulation\backend\services\med_extractor.py"
target = r"c:\Users\jorge\OneDrive\ProSolveSimulation\test01\shell.med"

cmd = f'cmd /c "cd /d {med_dir} && call env_launch.bat && python {extractor} {target}"'
print(f"Testing normal extraction on {target}...")
res = subprocess.run(cmd, capture_output=True, text=True, shell=True)

if res.returncode == 0:
    out = res.stdout.strip()
    lines = out.split('\n')
    data = None
    for line in reversed(lines):
        if line.strip().startswith('{'):
            try:
                data = json.loads(line)
                break
            except: continue
    
    if data and data['status'] == 'success':
        print(f"✓ Groups found: {list(data['cells'].keys())}")
        for k, v in data['cells'].items():
            has_normals = 'normals' in v
            normal_count = len(v['normals']) if has_normals else 0
            print(f"  - {k}: {v['count']} cells, normals: {has_normals} ({normal_count})")
            if has_normals and normal_count > 0:
                print(f"    Sample normal[0]: {v['normals'][0]}")
    else:
        print("Failed to parse JSON")
        print(res.stdout)
else:
    print(res.stderr)
