import sys
import os

def list_all(mod_name):
    print(f"\n--- Listing {mod_name} ---")
    try:
        mod = __import__(mod_name)
        attrs = [a for a in dir(mod) if not a.startswith('_')]
        print(f"Count: {len(attrs)}")
        # Look for anything containing 'Loader' or 'Loader'
        matches = [a for a in attrs if 'Loader' in a or 'Read' in a]
        print(f"Potential loaders: {matches}")
        if 'MEDLoader' in attrs:
            obj = getattr(mod, 'MEDLoader')
            print(f"MEDLoader type: {type(obj)}")
    except Exception as e:
        print(f"Error {mod_name}: {e}")

list_all('medcoupling')
list_all('MEDLoader')
