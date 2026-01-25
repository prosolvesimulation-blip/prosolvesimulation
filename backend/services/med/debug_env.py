import sys
import os
import json

print("\n--- PYTHON ENVIRONMENT DEBUG ---")
print(f"Executable: {sys.executable}")
print(f"Path: {sys.path}")
print(f"PYTHONPATH: {os.environ.get('PYTHONPATH', 'NOT SET')}")

try:
    import medcoupling
    print(f"SUCCESS: medcoupling imported from {medcoupling.__file__}")
    from medcoupling import MEDLoader
    print("SUCCESS: MEDLoader imported")
except Exception as e:
    print(f"ERROR: medcoupling import failed: {e}")

print("--- END DEBUG ---\n")
