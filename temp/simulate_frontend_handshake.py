import subprocess
import json
import os

# ==============================================================================
# SIMULATE_FRONTEND_HANDSHAKE.PY - ETAPA 3: VALIDAÇÃO EM /TEMP
# ==============================================================================

base_dir = r"c:\Users\jorge\OneDrive\ProSolveSimulation"
med_dir = os.path.join(base_dir, "MEDCOUPLING-9.15.0", "MEDCOUPLING-9.15.0")
extractor = os.path.join(base_dir, "backend", "services", "med", "med_extractor.py")
output_dump = os.path.join(base_dir, "temp", "global_state_dump.json")

test_files = {
    "shell": os.path.join(base_dir, "testcases", "shell", "shell.med"),
    "beam": os.path.join(base_dir, "testcases", "beam", "beam.med")
}

def handshake():
    print("--- SIMULATING FRONTEND HANDSHAKE ---")
    
    for key, path in test_files.items():
        if not os.path.exists(path):
            print(f"Skipping {key}: File not found.")
            continue
            
        print(f"\nProcessing: {os.path.basename(path)}...")
        
        # Chamar via subprocess (como a API faz)
        cmd = f'cmd /c "cd /d {med_dir} && call env_launch.bat && python \"{extractor}\" \"{path}\""'
        res = subprocess.run(cmd, capture_output=True, text=True, shell=True)
        
        if res.returncode == 0:
            # Pegar última linha (JSON minificado)
            output = res.stdout.strip().split('\n')[-1]
            try:
                data = json.loads(output)
                if data['status'] == 'success':
                    print(f"✓ Extracted: {data['filename']}")
                    
                    # SIMULAÇÃO JS (window.projectState consumption)
                    groups = data['data']['groups']
                    found_target = False
                    for name, info in groups.items():
                        # Critério de Sucesso do Protocolo
                        print(f"  > Group: {name[:20]:<20} | Cat: {info['category']:<4} | Normals: {'YES' if info['normals'] else 'NO'}")
                        
                        if info['category'] == "2D" and info['normals']: found_target = True
                        if info['category'] == "1D" and info['normals']: 
                            print("    [FAIL] 1D elements should NOT have normals!")
                            
                    # Persistir dump do último arquivo (shell costuma ser o mais rico)
                    if key == "shell":
                        with open(output_dump, 'w', encoding='utf-8') as f:
                            json.dump(data, f, indent=2)
                        print(f"\n[DUMP] Global state simulation saved to: {output_dump}")
                else:
                    print(f"  [ERROR] Extractor returned status error: {data.get('message')}")
            except Exception as e:
                print(f"  [ERROR] Failed to parse JSON or simulate JS logic: {e}")
        else:
            print(f"  [CRITICAL] Subprocess failed: {res.stderr}")

if __name__ == "__main__":
    handshake()
