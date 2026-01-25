import os
import sys
import subprocess
import json
import tkinter as tk
from tkinter import filedialog
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)

# 🔌 SEGURANÇA: Permite que qualquer porta do Frontend (dinâmica) fale com a 5000
CORS(app, resources={r"/*": {"origins": "*"}})




# ==============================================================================
# 🤝 ROTA DE HANDSHAKE (COM LOG VISUAL)
# ==============================================================================
@app.route('/api/handshake', methods=['POST'])
def handshake():
    try:
        data = request.get_json()
        frontend_url = data.get('origin')
        
        print("\n" + "="*60)
        print(f"🤝 HANDSHAKE CONFIRMADO NO BACKEND!")
        print(f"📍 O Frontend se identificou na porta: {frontend_url}")
        print("🔓 Canal de comunicação estabelecido.")
        print("="*60 + "\n")
        
        return jsonify({"status": "paired", "message": "Backend connected", "backend_port": 5000})
    except Exception as e:
        print(f"❌ Erro no Handshake: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500




@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "online", "service": "ProSolve Backend"})




# ==============================================================================
# 📂 ROTAS DE ARQUIVO (Necessárias para o Scan funcionar)
# ==============================================================================
@app.route('/api/browse_folder', methods=['POST'])
def browse_folder():
    try:
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        folder_selected = filedialog.askdirectory()
        root.destroy()
        
        if folder_selected:
            return jsonify({"status": "success", "path": os.path.normpath(folder_selected)})
        return jsonify({"status": "cancelled", "path": None})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500



@app.route('/api/scan_workspace', methods=['POST'])
def scan_workspace():
    data = request.get_json()
    folder_path = data.get('folder_path')
    if not folder_path or not os.path.exists(folder_path):
        return jsonify({"Geometry": False, "Mesh": False}) # Resposta simplificada
    
    files = os.listdir(folder_path)
    # Lógica simplificada de retorno
    return jsonify({
        "Geometry": any(f.lower().endswith(('.stp', '.step')) for f in files),
        "Mesh": any(f.lower().endswith(('.med', '.msh')) for f in files),
        "Config": any(f.lower().endswith(('.comm', '.py')) for f in files),
        "Post-Pro": any(f.lower().endswith(('.rmed', '.res')) for f in files),
        "files": {
            "Geometry": [f for f in files if f.lower().endswith(('.stp', '.step'))],
            "Mesh": [f for f in files if f.lower().endswith(('.med', '.msh'))],
            "Config": [f for f in files if f.lower().endswith(('.comm', '.py'))],
            "Post-Pro": [f for f in files if f.lower().endswith(('.rmed', '.res'))]
        }
    })




# ==============================================================================
# 🧬 MED CONVERTER (Localizador Inteligente)
# # ==============================================================================
# @app.route('/api/mesh_dna', methods=['POST'])
# def api_mesh_dna():
#     try:
#         data = request.get_json()
#         file_path = data.get('file_path')

#         if not file_path or not os.path.exists(file_path):
#             return jsonify({"status": "error", "message": "Arquivo inválido"}), 400

#         print(f"🧬 [MED_API] Solicitado DNA para: {os.path.basename(file_path)}")

#         # --- LOCALIZADOR DE CAMINHOS ---
#         base_dir = os.path.dirname(os.path.abspath(__file__))
        
#         # 1. Acha o MEDCOUPLING (Tenta na raiz ou pasta acima)
#         med_roots = [
#             os.path.join(base_dir, "MEDCOUPLING-9.15.0", "MEDCOUPLING-9.15.0"),
#             os.path.join(base_dir, "..", "MEDCOUPLING-9.15.0", "MEDCOUPLING-9.15.0")
#         ]
#         med_dir = next((p for p in med_roots if os.path.exists(p)), None)

#         # 2. Acha o script med_extractor.py
#         script_locs = [
#             os.path.join(base_dir, "services", "med", "med_extractor.py"),
#             os.path.join(base_dir, "med_extractor.py"),
#             os.path.join(base_dir, "prosolve", "med_extractor.py") # Caso esteja na pasta prosolve
#         ]
#         extractor_script = next((p for p in script_locs if os.path.exists(p)), None)

#         if not med_dir or not extractor_script:
#             print(f"❌ [MED_API] Erro Fatal: Dependências não encontradas.\nMED: {med_dir}\nScript: {extractor_script}")
#             return jsonify({"status": "error", "message": "Server misconfiguration"}), 500

#         # Executa
#         cmd = f'cmd /c "cd /d "{med_dir}" && call env_launch.bat && python "{extractor_script}" "{file_path}""'
#         result = subprocess.run(cmd, capture_output=True, text=True, shell=True)

#         if result.returncode == 0:
#             # Parseia a saída
#             output_lines = result.stdout.strip().split('\n')
#             for line in reversed(output_lines):
#                 line = line.strip()
#                 if line.startswith('{') and line.endswith('}'):
#                     try:
#                         return jsonify(json.loads(line))
#                     except: continue
#             return jsonify({"status": "error", "message": "JSON não encontrado na saída"}), 500
#         else:
#             print(f"❌ [MED_API] Erro no subprocesso:\n{result.stderr}")
#             return jsonify({"status": "error", "message": result.stderr}), 500

#     except Exception as e:
#         print(f"❌ [MED_API] Exceção: {e}")
#         return jsonify({"status": "error", "message": str(e)}), 500



if __name__ == '__main__':
    print("🚀 ProSolve Global Server (Porta 5000) - Aguardando Handshake...")
    app.run(host='0.0.0.0', port=5000, debug=True)