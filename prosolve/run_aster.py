import sys
import os
import subprocess

# --- CONFIGURAÇÃO ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "config.txt")

def carregar_config():
    """Lê o arquivo config.txt e retorna um dicionário"""
    configs = {}
    if not os.path.exists(CONFIG_FILE):
        print(f"[ERRO] Arquivo de configuração não encontrado: {CONFIG_FILE}")
        return configs
    
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                # Ignora linhas vazias ou comentários
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    key, value = line.split('=', 1)
                    configs[key.strip()] = value.strip()
    except Exception as e:
        print(f"[ERRO] Falha ao ler config.txt: {e}")
    
    return configs

def executar_simulacao():
    print("-" * 60)
    print("   WRAPPER DE EXECUÇÃO CODE_ASTER (PYTHON)")
    print("-" * 60)

    # 1. Carregar Configurações
    config = carregar_config()
    aster_bin = config.get("ASTER_BIN")

    if not aster_bin:
        print("[ERRO] 'ASTER_BIN' não definido no config.txt")
        return
    
    if not os.path.exists(aster_bin):
        print(f"[ERRO] Executável do Aster não encontrado no caminho configurado:\n{aster_bin}")
        return

    # 2. Validar Argumentos
    if len(sys.argv) < 2:
        print("[ERRO] Caminho do arquivo export.export não foi fornecido.")
        return

    export_path = sys.argv[1]

    if not os.path.exists(export_path):
        print(f"[ERRO] O arquivo export não existe: {export_path}")
        return

    # 3. Definir Diretório de Trabalho
    working_dir = os.path.dirname(export_path)

    print(f"[INFO] Aster Bin: {aster_bin}")
    print(f"[INFO] Export:    {export_path}")
    print(f"[INFO] Executando Code_Aster...")

    try:
        # 4. Executar o Comando
        processo = subprocess.run(
            [aster_bin, export_path],
            cwd=working_dir,
            shell=True,
            capture_output=True,
            text=True
        )

        if processo.returncode == 0:
            print("\n[SUCESSO] O Code_Aster finalizou a execução.")
        else:
            print(f"\n[FALHA] O Code_Aster retornou código de erro: {processo.returncode}")
            print("--- STDERR ---")
            print(processo.stderr)
            print("--- STDOUT ---")
            # print(processo.stdout[-1000:]) # Opcional: mostrar final do log

    except Exception as e:
        print(f"\n[CRITICO] Erro inesperado: {e}")

if __name__ == "__main__":
    executar_simulacao()