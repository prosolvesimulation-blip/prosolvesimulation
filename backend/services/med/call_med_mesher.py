import subprocess
import os
import sys

# 1. CONFIGURAÇÃO DE CAMINHOS (Relativos ao local deste script)
# Este script está em: ProSolveSimulation/backend/services/med/call_med_mesher.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Sobe 3 níveis para chegar na raiz: med -> services -> backend -> ProSolveSimulation
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "..", ".."))

def run_batch_med_processing(target_folder):
    """
    Recebe um endereço completo, identifica arquivos .med e processa cada um.
    """
    # Verificação do diretório de input
    if not os.path.exists(target_folder):
        print(f"[ERRO] O diretório informado não existe: {target_folder}")
        return

    # Caminhos das ferramentas (absolutos baseados na raiz detectada)
    med_env_dir = os.path.join(ROOT_DIR, "MEDCOUPLING-9.15.0", "MEDCOUPLING-9.15.0")
    mesher_script = os.path.join(ROOT_DIR, "backend", "services", "med", "med_mesher.py")

    # Validação da ferramenta MEDCOUPLING
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
    print(f"Arquivos encontrados: {len(med_files)}")
    print("-" * 40)

    # 3. LOOP DE PROCESSAMENTO
    for index, filename in enumerate(med_files, 1):
        full_med_path = os.path.join(target_folder, filename)
        
        print(f"[{index}/{len(med_files)}] Processando: {filename}...")

        # Montagem do comando CMD para este arquivo específico
        # cd /d {med_env_dir} -> Entra na pasta do ambiente
        # call env_launch.bat -> Ativa as variáveis
        # cd /d {ROOT_DIR}    -> Volta para a raiz para o python achar os caminhos
        # python {mesher}     -> Executa o conversor
        command = (
            f'cmd /c "cd /d "{med_env_dir}" && '
            f'call env_launch.bat && '
            f'cd /d "{ROOT_DIR}" && '
            f'python "{mesher_script}" "{full_med_path}""'
        )

        try:
            # Executa e espera terminar antes de ir para o próximo
            subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
            print(f"   [OK] Sucesso: {filename.replace('.med', '.json')} gerado.")
        except subprocess.CalledProcessError as e:
            print(f"   [FALHA] Erro ao processar {filename}")
            print(f"   Detalhes: {e.stderr}")

    print("-" * 40)
    print(f"--- Batch Processing Finalizado ---")

if __name__ == "__main__":
    # Permite passar o endereço via linha de comando ou usa um padrão
    if len(sys.argv) > 1:
        input_path = sys.argv[1]
    else:
        # Exemplo de fallback para sua pasta de testes
        input_path = os.path.join(ROOT_DIR, "testcases", "hibrido")

    run_batch_med_processing(input_path)