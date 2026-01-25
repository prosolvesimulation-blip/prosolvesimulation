import sys
import os
import json
import subprocess
import threading
import time
import requests
from flask import Flask, request, jsonify

# ==============================================================================
# TEST_PIPELINE_HANDSHAKE.PY - ETAPA 3: SIMULAÇÃO DE FLUXO COMPLETO
# ==============================================================================

app = Flask(__name__)

# Mock do Endpoint Real
@app.route('/api/mesh_dna', methods=['POST'])
def api_mesh_dna():
    try:
        data = request.get_json()
        file_path = data.get('file_path')
        
        # Telemetry: Port
        port = 5001
        print(f"\n[SERVER] [MED_API] Serving mesh data on Port: {port}")

        # Execute med_extractor.py
        base_dir = r"c:\Users\jorge\OneDrive\ProSolveSimulation"
        med_dir = os.path.join(base_dir, "MEDCOUPLING-9.15.0", "MEDCOUPLING-9.15.0")
        extractor = os.path.join(base_dir, "backend", "services", "med", "med_extractor.py")
        
        cmd = f'cmd /c "cd /d {med_dir} && call env_launch.bat && python \"{extractor}\" \"{file_path}\""'
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True)

        if result.returncode == 0:
            output = result.stdout.strip().split('\n')[-1]
            extracted_data = json.loads(output)
            
            # Telemetry: Groups (Protocol)
            groups = list(extracted_data['data']['groups'].keys())
            print(f"[SERVER] [MED_API] Extracted Groups: {groups}")
            return jsonify(extracted_data)
        else:
             return jsonify({"status": "error", "message": result.stderr}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

def run_server():
    app.run(port=5001, debug=False, use_reloader=False)

def run_client():
    time.sleep(2) # Espera o servidor subir
    
    print("--- [CLIENT] STARTING PIPELINE HANDSHAKE ---")
    base_dir = r"c:\Users\jorge\OneDrive\ProSolveSimulation"
    test_mesh = os.path.join(base_dir, "testcases", "shell", "shell.med")
    
    start_time = time.time()
    try:
        # Mocking the fetch call
        print(f"[CLIENT] Fetching Mesh DNA from port 5001...")
        response = requests.post("http://localhost:5001/api/mesh_dna", 
                               json={"file_path": test_mesh})
        
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            groups = data['data']['groups']
            
            print(f"[CLIENT] [MeshDNA] Groups Received: {list(groups.keys())}")
            print(f"[CLIENT] Performance Check: Request took {elapsed:.2f} seconds.")
            
            # Validation Logic
            found_shell = False
            for name, info in groups.items():
                if info['category'] == "2D":
                    if info['normals'] and len(info['normals']) > 0:
                        print(f"  > [PASS] Group '{name}' has normals.")
                        found_shell = True
                    else:
                         print(f"  > [FAIL] Group '{name}' is 2D but has NO normals.")
            
            if found_shell:
                print("\n[SUCCESS] Pipeline Handshake Verified!")
            else:
                 print("\n[WARNING] No 2D groups found to verify normals.")
                 
        else:
            print(f"[CLIENT] FAILED: {response.text}")
            
    except Exception as e:
        print(f"[CLIENT] CRITICAL ERROR: {e}")

if __name__ == "__main__":
    # Inicia servidor em thread separada
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    
    # Inicia o cliente
    run_client()
    
    print("\n--- SHUTTING DOWN MOCK SERVER ---")
