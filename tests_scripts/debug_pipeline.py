#!/usr/bin/env python3
"""
Debug script to trace the complete pipeline and find where beams get 3D modelization
"""

import sys
import os
import json

# Add paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'services', 'jinja', 'builders'))

def debug_pipeline():
    """Debug the complete pipeline to find the issue"""
    
    print("🔍 DEBUGGING COMPLETE PIPELINE")
    print("=" * 60)
    
    # Simulate what the frontend sends - this is the key issue
    print("\n1. FRONTEND DATA SIMULATION")
    print("-" * 40)
    
    # This is what the frontend ModelConfig.tsx sends
    frontend_data = {
        "group": "test_beam_group",
        "type": "POU_D_E",  # User selects Euler beam
        "section_type": "BEAM"
    }
    
    print(f"Frontend sends: {frontend_data}")
    
    # 2. Check what geometry.py receives
    print("\n2. GEOMETRY BUILDER PROCESSING")
    print("-" * 40)
    
    try:
        from geometry import build_geometry
        
        # Debug the processing step by step
        item = frontend_data
        group = item["group"]
        element_type = item.get("type", "Solid").upper()
        section_type = item.get("section_type", "").upper()
        
        print(f"group: {group}")
        print(f"element_type: {element_type}")
        print(f"section_type: {section_type}")
        
        # This is the critical logic
        if not section_type:
            print("section_type is empty - running fallback logic...")
            if element_type in ["SHELL", "DKT", "DST", "COQUE"]:
                section_type = "SHELL"
            elif element_type in ["BEAM", "POUTRE", "BARRE"]:
                section_type = "BEAM"
            else:
                section_type = "SOLID"
        
        print(f"Final section_type: {section_type}")
        
        # Check which branch will be taken
        if section_type == "SHELL":
            print("→ Will take SHELL branch")
        elif section_type in ["I_SECTION", "RECTANGLE", "BOX", "CIRCLE", "TUBE", "BEAM"]:
            print("→ Will take BEAM branch")
        else:
            print("→ Will take SOLID/3D branch")
        
        # Actually call the function
        result = build_geometry([item], "TEST_MODELE", "TEST_CARA")
        
        print(f"\nResult from build_geometry:")
        print(f"model_items: {result['model_items']}")
        
        # 3. Check what goes to the template
        print("\n3. TEMPLATE DATA")
        print("-" * 40)
        
        model_data = { 
            "result_name": "TEST_MODELE", 
            "mesh_name": "TEST_MESH", 
            "items": result["model_items"] 
        }
        
        for item in model_data["items"]: 
            item["phenomene"] = "MECANIQUE"
        
        print(f"Data sent to template: {model_data}")
        
        # 4. Simulate template rendering
        print("\n4. TEMPLATE RENDERING")
        print("-" * 40)
        
        from jinja2 import Template
        
        template_str = """{{ result_name }} = AFFE_MODELE(
    MAILLAGE={{ mesh_name }},
    AFFE=(
    {%- for item in items %}
        _F(GROUP_MA='{{ item.group }}', PHENOMENE='{{ item.phenomene }}', MODELISATION='{{ item.modelisation }}'),
    {%- endfor %}
    ),
);"""
        
        template = Template(template_str)
        rendered = template.render(**model_data)
        
        print("Generated .comm content:")
        print(rendered)
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

def debug_real_project():
    """Debug with a real project.json structure"""
    
    print("\n\n🔍 DEBUGGING REAL PROJECT STRUCTURE")
    print("=" * 60)
    
    # Check what the frontend actually sends
    print("\n1. CHECKING FRONTEND EXPORT FORMAT")
    print("-" * 40)
    
    # From ModelConfig.tsx line 132-145 - this is what gets exported
    frontend_export = {
        "group": "beam_group",
        "_meshFile": "beam.med",
        "type": "POU_D_E",  # This should be the beam model
        "formulation": None,  # Only for DKT/DST
        "phenomenon": "MECANIQUE",
        "_category": "1D"
    }
    
    print(f"Frontend export format: {frontend_export}")
    
    # Check if section_type is missing
    if "section_type" not in frontend_export:
        print("❌ CRITICAL ISSUE: 'section_type' is missing from frontend export!")
        print("This causes the geometry builder to use fallback logic")
        
        # What happens in fallback
        element_type = frontend_export.get("type", "Solid").upper()
        print(f"element_type (from 'type' field): {element_type}")
        
        if element_type in ["POU_D_E", "POU_D_T", "BARRE"]:
            print("❌ These are NOT in the fallback list ['BEAM', 'POUTRE', 'BARRE']")
            print("→ section_type becomes 'SOLID'")
            print("→ Goes to SOLID/3D branch")
            print("→ Gets MODELISATION='3D'")
            return True
    
    return False

if __name__ == "__main__":
    debug_pipeline()
    issue_found = debug_real_project()
    
    if issue_found:
        print("\n" + "=" * 60)
        print("🎯 ISSUE IDENTIFIED!")
        print("=" * 60)
        print("The frontend exports 'type': 'POU_D_E' but the backend")
        print("expects 'section_type': 'BEAM' for proper beam processing.")
        print("\nSOLUTION: Frontend needs to include 'section_type': 'BEAM'")
        print("OR backend needs to recognize POU_D_E/POU_D_T as beam types.")
    else:
        print("\n✅ No obvious issues found in the pipeline")
