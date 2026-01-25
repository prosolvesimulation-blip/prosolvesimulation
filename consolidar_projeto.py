import os

def consolidar_projeto():
    # Definição dos caminhos
    root_dir = os.path.dirname(os.path.abspath(__file__))
    prosolve_dir = os.path.join(root_dir, 'prosolve')
    output_file = os.path.join(root_dir, 'PROJETO CONSOLIDADO.txt')
    
    # Extensões permitidas
    extensões_prosolve = ('.py', '.j2', '.js')
    extensões_raiz = ('.py')
    
    print(f"Iniciando consolidação em: {output_file}")
    
    with open(output_file, 'w', encoding='utf-8') as outfile:
        # 1. Processar arquivos .py na raiz
        outfile.write("================================================================================\n")
        outfile.write("ARQUIVOS DA RAÍZ DO PROJETO\n")
        outfile.write("================================================================================\n\n")
        
        for file in os.listdir(root_dir):
            if file.endswith(extensões_raiz) and os.path.isfile(os.path.join(root_dir, file)):
                file_path = os.path.join(root_dir, file)
                outfile.write(f"--- ARQUIVO: {file} ---\n")
                try:
                    with open(file_path, 'r', encoding='utf-8') as infile:
                        outfile.write(infile.read())
                    outfile.write("\n\n")
                except Exception as e:
                    outfile.write(f"Erro ao ler arquivo: {e}\n\n")

        # 2. Processar pasta prosolve (recursivo)
        if os.path.exists(prosolve_dir):
            outfile.write("================================================================================\n")
            outfile.write("CONTEÚDO DA PASTA PROSOLVE\n")
            outfile.write("================================================================================\n\n")
            
            for root, dirs, files in os.walk(prosolve_dir):
                for file in files:
                    if file.endswith(extensões_prosolve):
                        file_path = os.path.join(root, file)
                        rel_path = os.path.relpath(file_path, root_dir)
                        outfile.write(f"--- ARQUIVO: {rel_path} ---\n")
                        try:
                            with open(file_path, 'r', encoding='utf-8') as infile:
                                outfile.write(infile.read())
                            outfile.write("\n\n")
                        except Exception as e:
                            outfile.write(f"Erro ao ler arquivo: {e}\n\n")
        else:
            outfile.write("\nPASTA 'prosolve' NÃO ENCONTRADA.\n")

    print("Projeto consolidado com sucesso!")

if __name__ == "__main__":
    consolidar_projeto()
