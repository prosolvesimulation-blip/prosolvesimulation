import subprocess
import json
import os
import sys

# ==============================================================================
# VALIDATE_GLOBAL_STATE_DATA.PY - ETAPA 3: VALIDAÇÃO EM /TEMP
# ==============================================================================

base_dir = r"c:\Users\jorge\OneDrive\ProSolveSimulation"
med_dir = os.path.join(base_dir, "MEDCOUPLING-9.15.0", "MEDCOUPLING-9.15.0")
extractor_path = os.path.join(base_dir, "backend", "services", "med", "med_extractor.py")
test_mesh = os.path.join(base_dir, "testcases", "shell", "shell.med")
output_debug = os.path.join(base_dir, "temp", "debug_extraction.json")

def validate():
    print("--- INICIANDO VALIDAÇÃO DE PROTOCOLO ---")
    
    if not os.path.exists(test_mesh):
        print(f"Erro: Arquivo de teste não encontrado em {test_mesh}")
        return

    # Comando para rodar no ambiente MEDCoupling
    cmd = f'cmd /c "cd /d {med_dir} && call env_launch.bat && python \"{extractor_path}\" \"{test_mesh}\""'
    
    print(f"Executando extração em {os.path.basename(test_mesh)}...")
    res = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    
    if res.returncode != 0:
        print("FALHA CRÍTICA NO SUBPROCESSO:")
        print(res.stderr)
        return

    # Tenta encontrar e processar o JSON
    try:
        out_lines = res.stdout.strip().split('\n')
        data = None
        for line in reversed(out_lines):
            line = line.strip()
            if line.startswith('{') and line.endswith('}'):
                data = json.loads(line)
                break
        
        if not data or data.get("status") != "success":
            print("FALHA: JSON retornado é inválido ou status != success")
            print(f"Saída bruta: {res.stdout[:500]}")
            return

        print("\n--- CHECKLIST DE SUCESSO ---")
        groups = data.get("data", {}).get("groups", {})
        
        # 1. Verificar chave groups
        if groups:
            print("[OK] Chave 'groups' presente.")
        else:
            print("[FAIL] Chave 'groups' ausente ou vazia.")

        # 2. Verificar grupo de casca (dimension=2) e normais
        for g_name, g_info in groups.items():
            cat = g_info.get("category")
            has_norms = g_info.get("normals") is not None and len(g_info.get("normals")) > 0
            
            print(f"   -> Verificando Grupo '{g_name}' ({cat}):")
            
            if cat == "2D":
                if has_norms:
                    print(f"      [OK] Grupo 2D tem normais.")
                else:
                    print(f"      [FAIL] Grupo 2D deveria ter normais.")
            else:
                if not has_norms:
                    print(f"      [OK] Grupo {cat} não tem normais.")
                else:
                    print(f"      [FAIL] Grupo {cat} NÃO deveria ter normais.")

            # 3. Confirmar points e connectivity
            if len(g_info.get("points")) > 0 and len(g_info.get("connectivity")) > 0:
                print(f"      [OK] Malha válida (Pts: {len(g_info['points'])//3}, Conn: {len(g_info['connectivity'])})")
            else:
                print(f"      [FAIL] Dados de malha vazios.")

        # PERSISTÊNCIA
        with open(output_debug, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print(f"\n[SUCESSO] JSON de debug salvo em: {output_debug}")

    except Exception as e:
        print(f"ERRO DURANTE VALIDAÇÃO: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    validate()
