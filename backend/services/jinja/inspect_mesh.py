import sys
import json
import os
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

# --- CONFIGURAÇÃO DE CAMINHOS ---
# Localização deste script: root/jinja/inspect_mesh.py
BASE_DIR = Path(__file__).resolve().parent
BUILDERS_DIR = BASE_DIR / "builders"
TEMPLATES_DIR = BASE_DIR / "templates"

# Validação de diretórios essenciais
if not BUILDERS_DIR.exists():
    print(f"[ERROR] Diretorio de builders nao encontrado: {BUILDERS_DIR}")
    sys.exit(1)

if not TEMPLATES_DIR.exists():
    print(f"[ERROR] Diretorio de templates nao encontrado: {TEMPLATES_DIR}")
    sys.exit(1)

# Adiciona builders ao path do sistema para importação
sys.path.insert(0, str(BUILDERS_DIR))

try:
    from asse_maillage import build_asse_maillage
    # lire_maillage é opcional importar se fizermos o loop manual, mas asse é vital
except ImportError as e:
    print(f"[ERROR] Falha ao importar builders do Code_Aster: {e}")
    sys.exit(1)

def generate_inspection_comm(project_folder):
    """
    Orquestrador que lê o mesh.json e gera o arquivo de comando med.comm
    dentro da pasta simulation_files.
    """
    project_path = Path(project_folder)
    sim_files_path = project_path / "simulation_files"
    
    # ARQUIVO DE ENTRADA (Gerado pelo Python Main)
    mesh_json_path = sim_files_path / "mesh.json"
    
    # ARQUIVO DE SAÍDA (Onde o .comm será salvo)
    output_comm = sim_files_path / "med.comm"

    print(f"[INSPECT] Gerando .comm para: {project_path}")
    print(f"[INSPECT] Arquivo de destino: {output_comm}")

    # 1. Ler o JSON de Input (mesh.json)
    if not mesh_json_path.exists():
        print(f"[ERROR] mesh.json nao encontrado em: {mesh_json_path}")
        return False

    try:
        with open(mesh_json_path, 'r', encoding='utf-8') as f:
            mesh_config = json.load(f)
    except Exception as e:
        print(f"[ERROR] Falha ao ler ou decodificar mesh.json: {e}")
        return False

    # 2. Configurar Jinja2
    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)), trim_blocks=True, lstrip_blocks=True)
    
    try:
        tpl_lire = env.get_template("lire_maillage.j2")
        tpl_asse = env.get_template("asse_maillage.j2")
        tpl_inspect = env.get_template("inspect_mesh.j2")
    except Exception as e:
        print(f"[ERROR] Erro ao carregar templates Jinja: {e}")
        return False

    # 3. Processar Dados
    unit_start = mesh_config.get("unit_start", 80)
    meshes_list = mesh_config.get("meshes", [])
    
    if not meshes_list:
        print("[ERROR] Nenhuma malha definida dentro de mesh.json")
        return False
    
    try:
        # Inicio do arquivo .comm
        comm_content = "DEBUT(LANG='FR')\n\n"
        comm_content += "# --- 1. Leitura das Malhas ---\n"

        mesh_names = []
        
        # Loop para gerar comandos LIRE_MAILLAGE
        for i, mesh in enumerate(meshes_list):
            unit = unit_start + i
            mesh_name = mesh["name"]
            mesh_names.append(mesh_name)
            
            # O nome do arquivo no .comm é menos relevante se usarmos UNITE no export,
            # mas mantemos por consistência.
            filename = mesh.get("filename", f"{mesh_name}.med")
            
            # Renderiza template LIRE
            comm_content += tpl_lire.render(
                mesh_name=mesh_name,
                unit=unit,
                filename=filename
            ) + "\n"

        # Builder ASSE_MAILLAGE (Assembly)
        comm_content += "\n# --- 2. Assembly ---\n"
        asse_data = build_asse_maillage(mesh_names, result_name="MAIL")
        
        final_mesh_variable = "MAIL"
        
        # Lógica de renderização do Assembly
        if asse_data["mode"] == "ASSE":
            # Se houver múltiplas malhas, usa o comando ASSE_MAILLAGE
            comm_content += tpl_asse.render(**asse_data)
            final_mesh_variable = "MAIL"
            
        elif asse_data["mode"] == "SINGLE":
            # Se for única, o nome final é o nome da malha lida
            original_name = asse_data['final_mesh']
            
            # Cria alias MAIL = Mesh_Nome para padronizar o script de inspeção
            if original_name != "MAIL":
                 comm_content += f"MAIL = {original_name}\n"
                 final_mesh_variable = "MAIL"
        
        comm_content += "\n"

        # 4. Injeção do Script de Inspeção (Gera mesh_groups.json)
        comm_content += "# --- 3. Inspecao e Geracao de JSON ---\n"
        
        # --- PREPARAÇÃO DO CAMINHO ABSOLUTO ---
        # Converte para string e substitui backslash por forward slash para evitar 
        # problemas de escape string no Python gerado (ex: \t, \n, \r)
        abs_output_folder = str(sim_files_path.absolute()).replace("\\", "/")
        
        # Passamos a variável output_folder para o template
        comm_content += tpl_inspect.render(
            mesh_variable=final_mesh_variable,
            output_folder=abs_output_folder
        )
        comm_content += "\n"

        comm_content += "FIN()\n"

        # 5. Salvar Arquivo med.comm final na pasta simulation_files
        # --- Encoding="latin-1" para compatibilidade com Code_Aster Windows ---
        with open(output_comm, "w", encoding="latin-1") as f:
            f.write(comm_content)
            
        print(f"[INSPECT] med.comm gerado com sucesso em: {output_comm}")
        return True

    except Exception as e:
        print(f"[ERROR] Falha na construcao do conteudo .comm: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python inspect_mesh.py <caminho_do_projeto>")
        sys.exit(1)
    
    folder_arg = sys.argv[1]
    success_status = generate_inspection_comm(folder_arg)
    
    # Retorna código de saída para o subprocesso pai (main.pyw) capturar
    sys.exit(0 if success_status else 1)