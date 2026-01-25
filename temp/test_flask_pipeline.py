import requests
import os
import json
import time

# ==============================================================================
# TEST_FLASK_PIPELINE.PY
# Testa a integração entre main.py e o Frontend
# ==============================================================================

def run_test():
    print("--- INICIANDO TESTE DE INTEGRAÇÃO FLASK ---")
    
    # 1. Check Health
    try:
        health = requests.get("http://localhost:5000/health")
        if health.status_code == 200:
            print(f"[PASS] Server is Online: {health.json()}")
        else:
            print(f"[FAIL] Health check failed: {health.status_code}")
            return
    except Exception as e:
        print(f"[CRITICAL] Servidor não está rodando na porta 5000: {e}")
        print("DICA: Rode 'python backend/main.py' em outro terminal primeiro!")
        return

    # 2. Test Mesh DNA Extraction
    base_dir = r"c:\Users\jorge\OneDrive\ProSolveSimulation"
    shell_med = os.path.join(base_dir, "testcases", "shell", "shell.med")
    
    print(f"\nSolicitando DNA para: {os.path.basename(shell_med)}...")
    start_time = time.time()
    
    try:
        response = requests.post(
            "http://localhost:5000/api/mesh_dna",
            json={"file_path": shell_med}
        )
        
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            if data['status'] == 'success':
                groups = data['data']['groups']
                print(f"[PASS] Extração bem sucedida em {elapsed:.2f}s")
                print(f"[INFO] Grupos Recebidos: {list(groups.keys())}")
                
                # Verifica integridade mínima
                if "group_shell" in groups:
                    info = groups["group_shell"]
                    print(f"  > Validando 'group_shell': {info['count']} elementos")
                    if info['normals'] and len(info['normals']) > 0:
                        print("  > [OK] Normais presentes para 2D.")
                    else:
                        print("  > [FAIL] Normais ausentes para 2D.")
            else:
                print(f"[FAIL] Extrator retornou erro: {data.get('message')}")
        else:
            print(f"[FAIL] Erro HTTP {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f"[ERROR] Falha na requisição: {e}")

if __name__ == "__main__":
    run_test()
