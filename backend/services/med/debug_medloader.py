import sys
import os

print("\n--- MEDLOADER MODULE INSPECT ---")
try:
    import MEDLoader
    print(f"MEDLoader module file: {MEDLoader.__file__}")
    print("Attributes:", [a for a in dir(MEDLoader) if not a.startswith('_')][:30])
except Exception as e:
    print(f"CRITICAL: {e}")
print("--- END ---")
