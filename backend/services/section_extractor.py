#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Section Extractor - Independent Process for SectionProperties
FIX: Added robust path resolution to find the 'services' package.
"""
import sys
import os
import json
import traceback

# 🛠️ BOOTSTRAP: Add backend root to sys.path to resolve 'services' module
# Get absolute path to the 'backend' directory
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_root = os.path.dirname(current_dir)
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

def main():
    try:
        # 1. Read input from StdIn
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"status": "error", "message": "No input received"}))
            return
            
        params_bundle = json.loads(input_data)
        section_type = params_bundle.get('type')
        params = params_bundle.get('params', {})
        
        # 2. Lazy Import (Now safe after path bootstrap)
        from services.section_calculator import calculate_section_properties
        
        # 3. Calculate
        result = calculate_section_properties(section_type, params)
        
        # 4. Output result
        print(json.dumps(result))
        
    except Exception as e:
        error_info = {
            "status": "error",
            "message": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_info))

if __name__ == "__main__":
    main()
