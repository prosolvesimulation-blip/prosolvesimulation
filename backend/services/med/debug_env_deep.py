import sys
import os

print("\n--- DEEP INSPECT ---")
try:
    import medcoupling
    print(f"medcoupling found: {medcoupling.__file__}")
    print("Top-level attributes:", [a for a in dir(medcoupling) if not a.startswith('_')][:20], "...")
    
    if hasattr(medcoupling, 'MEDLoader'):
        print("SUCCESS: MEDLoader found in medcoupling")
    else:
        print("FAIL: MEDLoader NOT in medcoupling")
        
    # Try importing directly
    try:
        import MEDLoader
        print("SUCCESS: MEDLoader found as top-level module")
    except:
        print("FAIL: MEDLoader NOT a top-level module")
        
except Exception as e:
    print(f"CRITICAL: {e}")

print("--- END INSPECT ---\n")
