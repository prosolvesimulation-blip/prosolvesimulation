import subprocess
import os
import sys
from services.med.vtk_extruder import run_processing

# 1. CONFIGURAÇÃO DE CAMINHOS (Relativos ao local deste script)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".."))

def run_batch_med_processing(target_folder):
    """
    Recebe um endereço completo, identifica arquivos .med e processa cada um,
    apenas se o arquivo .json correspondente ainda não existir.
    """
    if not os.path.exists(target_folder):
        print(f"[ERRO] O diretório informado não existe: {target_folder}")
        return

    med_env_dir = os.path.join(ROOT_DIR, "MEDCOUPLING-9.15.0", "MEDCOUPLING-9.15.0")
    mesher_script = os.path.join(ROOT_DIR, "backend", "services", "med", "med_mesher.py")

    if not os.path.exists(med_env_dir):
        print(f"[ERRO] Ambiente MEDCOUPLING não encontrado em: {med_env_dir}")
        return

    # 2. IDENTIFICAÇÃO DOS ARQUIVOS .MED
    med_files = [f for f in os.listdir(target_folder) if f.lower().endswith('.med')]
    
    if not med_files:
        print(f"[AVISO] Nenhum arquivo .med encontrado em: {target_folder}")
        return

    print(f"--- Batch Processing Iniciado ---")
    print(f"Raiz do Projeto: {ROOT_DIR}")
    print(f"Diretório Alvo: {target_folder}")
    print("-" * 40)

    # 3. LOOP DE PROCESSAMENTO
    for index, filename in enumerate(med_files, 1):
        # Extrai o nome sem extensão e define o caminho do JSON esperado
        base_name = os.path.splitext(filename)[0]
        json_filename = base_name + ".json"
        
        full_med_path = os.path.join(target_folder, filename)
        full_json_path = os.path.join(target_folder, json_filename)

        # VERIFICAÇÃO: Se o JSON existe, pula para o próximo
        if os.path.exists(full_json_path):
            print(f"[{index}/{len(med_files)}] Ignorando: {filename} (JSON já existe)")
            continue
        
        print(f"[{index}/{len(med_files)}] Processando: {filename}...")

        # Montagem do comando CMD
        command = (
            f'cmd /c "cd /d "{med_env_dir}" && '
            f'call env_launch.bat && '
            f'cd /d "{ROOT_DIR}" && '
            f'python "{mesher_script}" "{full_med_path}""'
        )

        try:
            subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
            print(f"   [OK] Sucesso: {json_filename} gerado.")
        except subprocess.CalledProcessError as e:
            print(f"   [FALHA] Erro ao processar {filename}")
            print(f"   Detalhes: {e.stderr}")

    print("-" * 40)
    print(f"--- Batch Processing Finalizado ---")

    run_processing(target_folder)    



if __name__ == "__main__":
    if len(sys.argv) > 1:
        input_path = sys.argv[1]
    else:
        input_path = os.path.join(ROOT_DIR, "testcases", "hibrido")

    run_batch_med_processing(input_path)