import os
import sys
import socket
import threading
import webview
from flask import Flask, jsonify
from flask_cors import CORS
from api.routes import api_blueprint

# --- CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

def get_free_port():
    """Find a free port on localhost (strictly)."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        _, port = s.getsockname()
        return port

def create_app():
    """Initialize Flask App."""
    app = Flask(__name__, static_folder=STATIC_DIR, static_url_path='/')
    CORS(app) # Relaxed for dev, strict in prod if needed

    # Register Blueprints
    app.register_blueprint(api_blueprint, url_prefix='/api')

    @app.route('/')
    def index():
        return app.send_static_file('index.html')

    return app

def start_server(port, app):
    """Run Flask server."""
    app.run(host='127.0.0.1', port=port, threaded=True)

if __name__ == '__main__':
    port = get_free_port()
    app = create_app()
    
    # Start Flask in a separate thread
    t = threading.Thread(target=start_server, args=(port, app))
    t.daemon = True
    t.start()

    # Launch PyWebView
    # "Interface Only" - clean, beautiful window
    webview.create_window(
        'ProSolve Professional', 
        f'http://127.0.0.1:{port}',
        width=1280, 
        height=800,
        resizable=True,
        min_size=(1024, 600),
        background_color='#0f172a' # Match Slate-950 theme
    )
    
    webview.start(debug=False)
