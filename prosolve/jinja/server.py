import http.server
import subprocess
import webbrowser
import os
import json

PORT = 8000

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/run-aster':
            # Read JSON body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            
            try:
                data = json.loads(body) if body else {}
            except:
                data = {}
            
            os.makedirs("study", exist_ok=True)
            
            # Write mesh.json
            if "mesh" in data:
                mesh_path = os.path.join("study", "mesh.json")
                with open(mesh_path, "w", encoding="utf-8") as f:
                    json.dump(data["mesh"], f, indent=4)
                print(f"[Server] Wrote {mesh_path}")
            
            # Write ddl_impo.json
            ddl_data = {"ddl_impo": data.get("ddl_impo", [])}
            ddl_path = os.path.join("study", "ddl_impo.json")
            with open(ddl_path, "w", encoding="utf-8") as f:
                json.dump(ddl_data, f, indent=4)
            print(f"[Server] Wrote {ddl_path}")
            
            # Write pesanteur.json
            if "pesanteur" in data:
                pesanteur_path = os.path.join("study", "pesanteur.json")
                with open(pesanteur_path, "w", encoding="utf-8") as f:
                    json.dump(data["pesanteur"], f, indent=4)
                print(f"[Server] Wrote {pesanteur_path}")
            
            # Write load_cases.json
            if "load_cases" in data:
                lc_path = os.path.join("study", "load_cases.json")
                with open(lc_path, "w", encoding="utf-8") as f:
                    json.dump(data["load_cases"], f, indent=4)
                print(f"[Server] Wrote {lc_path}")

            # Write geometry.json
            if "geometries" in data:
                geom_list = data["geometries"]
                geom_data = {"geometries": geom_list}
                geom_path = os.path.join("study", "geometry.json")
                with open(geom_path, "w", encoding="utf-8") as f:
                    json.dump(geom_data, f, indent=4)
                print(f"[Server] Wrote {geom_path} ({len(geom_list)} items)")
            else:
                print("[Server] WARNING: 'geometries' not found in payload")
            
            # Run Generator and then Code_Aster
            print("[Server] Generating .comm and Running Code_Aster...")
            subprocess.Popen('start cmd /k "generate_comm.bat && run_aster.bat"', shell=True)
            
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(b"OK")
        else:
            self.send_error(404)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    webbrowser.open(f"http://localhost:{PORT}/studio.html")
    print(f"Server running on http://localhost:{PORT}")
    http.server.HTTPServer(("", PORT), Handler).serve_forever()
