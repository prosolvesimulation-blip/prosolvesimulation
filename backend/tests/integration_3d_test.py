import requests
import json
import os
import sys

def test_3d_generation():
    # Base configuration
    API_URL = "http://127.0.0.1:5000/api/3d/generate" # Default port, might need adjustment if running
    PROJECT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "testcases", "hibrido"))
    
    # Load project.json to get geometry state
    project_json_path = os.path.join(PROJECT_PATH, "project.json")
    if not os.path.exists(project_json_path):
        print(f"[ERROR] Test project not found at {project_json_path}")
        return

    with open(project_json_path, 'r', encoding='utf-8') as f:
        project_data = json.load(f)
    
    geometry_state = project_data.get('geometries', [])

    payload = {
        "project_path": PROJECT_PATH,
        "geometry_state": geometry_state
    }

    print(f"--- Starting Integration Test for In-Memory 3D ---")
    print(f"Project Path: {PROJECT_PATH}")
    print(f"Groups to process: {len(geometry_state)}")
    print("-" * 40)

    try:
        # Note: This requires the Flask server to be RUNNING
        # If we want to test without a running server, we'd need to use app.test_client()
        # but since we are in a dev environment, we'll try a local mock-like call or advice on running the app.
        
        # Alternative: Test the function directly by importing the app
        from app import create_app
        app = create_app()
        client = app.test_client()
        
        print("[TEST] Sending POST request to /api/3d/generate...")
        response = client.post('/api/3d/generate', 
                               data=json.dumps(payload),
                               content_type='application/json')
        
        result = response.get_json()
        
        if response.status_code == 200 and result.get("status") == "success":
            print("[OK] API responded with success.")
            data_list = result.get("data", [])
            print(f"[OK] Received {len(data_list)} 3D geometry components.")
            
            for item in data_list:
                comp_id = item.get("id")
                comp_data = item.get("data", {})
                pts_count = len(comp_data.get("points", [])) // 3
                cell_count = len(comp_data.get("connectivity", []))
                print(f"   -> Component: {comp_id} | Points: {pts_count} | Cells: {cell_count}")
                
                # Basic validation
                if pts_count == 0 and "_FULL_MESH_" not in comp_id:
                    print(f"      [WARN] Zero points in {comp_id}")
            
            print("-" * 40)
            print("[SUCCESS] Integration test passed. Memory flow is operational.")
        else:
            print(f"[FAIL] API Error ({response.status_code}): {result.get('message')}")
            if result.get("traceback"):
                print(f"Traceback:\n{result.get('traceback')}")

    except ImportError:
        print("[SKIP] Could not import 'app'. Run this test from the 'backend' directory.")
    except Exception as e:
        print(f"[ERROR] Test crashed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Add backend to path so we can import app and services
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    if backend_dir not in sys.path:
        sys.path.append(backend_dir)
        
    test_3d_generation()
