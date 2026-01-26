"""
Consolidar Projeto - Exporta os SCRIPTS do projeto (código fonte) para um único .txt
Apenas arquivos .py, .tsx e .j2 - os scripts que construímos
"""
import os
import subprocess

# APENAS extensões de código fonte do projeto
CODE_EXTENSIONS = {'.py', '.tsx', '.j2'}

# Arquivos/pastas a ignorar (mesmo que tenham extensão válida)
SKIP_FILES = {'consolidar_projeto.py', '__init__.py'}


def get_git_tracked_files(root_dir):
    """Usa git ls-files para obter todos os arquivos trackeados (respeita .gitignore)"""
    try:
        result = subprocess.run(
            ['git', 'ls-files'],
            cwd=root_dir,
            capture_output=True,
            text=True,
            check=True
        )
        files = result.stdout.strip().split('\n')
        return [f for f in files if f]
    except subprocess.CalledProcessError as e:
        print(f"Erro ao executar git ls-files: {e}")
        return []


def should_include(filepath):
    """Verifica se o arquivo deve ser incluído na consolidação"""
    basename = os.path.basename(filepath)
    ext = os.path.splitext(filepath)[1].lower()
    
    # Ignorar arquivos específicos
    if basename in SKIP_FILES:
        return False
    
    # Apenas extensões permitidas
    return ext in CODE_EXTENSIONS


def consolidar_projeto():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    output_file = os.path.join(root_dir, 'PROJETO CONSOLIDADO.txt')
    
    print(f"[1/3] Obtendo lista de arquivos do Git...")
    all_files = get_git_tracked_files(root_dir)
    
    if not all_files:
        print("ERRO: Nenhum arquivo encontrado. Certifique-se de estar em um repositório Git.")
        return
    
    # Filtrar apenas os scripts (.py, .tsx, .j2)
    script_files = [f for f in all_files if should_include(f)]
    
    print(f"[2/3] Encontrados {len(script_files)} scripts (.py, .tsx, .j2) de {len(all_files)} arquivos totais.")
    
    # Organizar por pasta
    files_by_folder = {}
    for filepath in script_files:
        folder = os.path.dirname(filepath) or '(raiz)'
        if folder not in files_by_folder:
            files_by_folder[folder] = []
        files_by_folder[folder].append(filepath)
    
    print(f"[3/3] Consolidando em: {output_file}")
    
    with open(output_file, 'w', encoding='utf-8') as outfile:
        outfile.write("=" * 80 + "\n")
        outfile.write("PROJETO CONSOLIDADO - PROSOLVE SIMULATION\n")
        outfile.write(f"Scripts do projeto: {len(script_files)} arquivos (.py, .tsx, .j2)\n")
        outfile.write("=" * 80 + "\n\n")
        
        # Listar estrutura primeiro
        outfile.write("-" * 80 + "\n")
        outfile.write("ESTRUTURA DOS SCRIPTS\n")
        outfile.write("-" * 80 + "\n")
        for folder in sorted(files_by_folder.keys()):
            outfile.write(f"  {folder}/\n")
            for filepath in sorted(files_by_folder[folder]):
                outfile.write(f"    - {os.path.basename(filepath)}\n")
        outfile.write("\n\n")
        
        # Conteúdo dos arquivos
        outfile.write("=" * 80 + "\n")
        outfile.write("CONTEÚDO DOS SCRIPTS\n")
        outfile.write("=" * 80 + "\n\n")
        
        for folder in sorted(files_by_folder.keys()):
            outfile.write(f"\n{'#' * 80}\n")
            outfile.write(f"# PASTA: {folder}\n")
            outfile.write(f"{'#' * 80}\n\n")
            
            for filepath in sorted(files_by_folder[folder]):
                full_path = os.path.join(root_dir, filepath)
                outfile.write(f"--- ARQUIVO: {filepath} ---\n")
                try:
                    with open(full_path, 'r', encoding='utf-8', errors='replace') as infile:
                        content = infile.read()
                        outfile.write(content)
                        if not content.endswith('\n'):
                            outfile.write('\n')
                    outfile.write("\n")
                except Exception as e:
                    outfile.write(f"[ERRO AO LER: {e}]\n\n")
    
    print(f"\n✓ Consolidação concluída!")
    print(f"  - Scripts incluídos: {len(script_files)}")
    print(f"  - Saída: {output_file}")


if __name__ == "__main__":
    consolidar_projeto()
