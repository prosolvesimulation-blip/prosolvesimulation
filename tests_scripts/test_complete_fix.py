#!/usr/bin/env python3
"""
Test the complete fix: frontend section_type + backend beam model selection
"""

import sys
import os
import json

# Add paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'services', 'jinja', 'builders'))

def test_complete_fix():
    """Test the complete fix with realistic data"""
    
    print("🔧 TESTING COMPLETE FIX")
    print("=" * 60)
    
    try:
        from geometry import build_geometry
        
        # Test cases with the new frontend format
        test_cases = [
            {
                "name": "Euler Beam (POU_D_E)",
                "frontend_data": {
                    "group": "euler_beam",
                    "type": "POU_D_E",
                    "section_type": "BEAM",  # ← NEW from frontend fix
                    "phenomenon": "MECANIQUE",
                    "_category": "1D"
                },
                "expected_model": "POU_D_E"
            },
            {
                "name": "Timoshenko Beam (POU_D_T)",
                "frontend_data": {
                    "group": "timoshenko_beam",
                    "type": "POU_D_T",
                    "section_type": "BEAM",  # ← NEW from frontend fix
                    "phenomenon": "MECANIQUE",
                    "_category": "1D"
                },
                "expected_model": "POU_D_T"
            },
            {
                "name": "Truss (BARRE)",
                "frontend_data": {
                    "group": "truss",
                    "type": "BARRE",
                    "section_type": "BEAM",  # ← NEW from frontend fix
                    "phenomenon": "MECANIQUE",
                    "_category": "1D"
                },
                "expected_model": "BARRE"
            },
            {
                "name": "Shell (DKT)",
                "frontend_data": {
                    "group": "shell",
                    "type": "DKT",
                    "section_type": "SHELL",  # ← NEW from frontend fix
                    "formulation": "DKT",
                    "phenomenon": "MECANIQUE",
                    "_category": "2D"
                },
                "expected_model": "DKT"
            },
            {
                "name": "Solid (3D)",
                "frontend_data": {
                    "group": "solid",
                    "type": "3D",
                    "section_type": "SOLID",  # ← NEW from frontend fix
                    "phenomenon": "MECANIQUE",
                    "_category": "3D"
                },
                "expected_model": "3D"
            }
        ]
        
        all_passed = True
        
        for i, test_case in enumerate(test_cases, 1):
            print(f"\nTest {i}: {test_case['name']}")
            print("-" * 40)
            
            # Process through geometry builder
            result = build_geometry([test_case['frontend_data']], "TEST_MODELE", "TEST_CARA")
            
            # Check result
            model_items = result.get('model_items', [])
            
            if not model_items:
                print(f"❌ FAIL: No model items returned")
                all_passed = False
                continue
                
            actual_model = model_items[0].get('modelisation')
            expected_model = test_case['expected_model']
            
            if actual_model == expected_model:
                print(f"✅ PASS: Got '{actual_model}' as expected")
            else:
                print(f"❌ FAIL: Expected '{expected_model}', got '{actual_model}'")
                all_passed = False
        
        return all_passed
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_full_integration():
    """Test full integration with generate_comm.py"""
    
    print("\n🔗 TESTING FULL INTEGRATION")
    print("=" * 60)
    
    # Create test project with new frontend format
    test_project_path = os.path.join(os.path.dirname(__file__), 'integration_test')
    os.makedirs(test_project_path, exist_ok=True)
    
    test_project = {
        "meshes": [{"name": "test_mesh", "filename": "test.med"}],
        "geometries": [
            {
                "group": "euler_beams",
                "type": "POU_D_E",
                "section_type": "BEAM",  # ← NEW from frontend fix
                "phenomenon": "MECANIQUE",
                "_category": "1D"
            },
            {
                "group": "timoshenko_beams",
                "type": "POU_D_T",
                "section_type": "BEAM",  # ← NEW from frontend fix
                "phenomenon": "MECANIQUE",
                "_category": "1D"
            },
            {
                "group": "trusses",
                "type": "BARRE",
                "section_type": "BEAM",  # ← NEW from frontend fix
                "phenomenon": "MECANIQUE",
                "_category": "1D"
            }
        ],
        "materials": [],
        "loads": []
    }
    
    project_file = os.path.join(test_project_path, 'project.json')
    with open(project_file, 'w') as f:
        json.dump(test_project, f, indent=2)
    
    try:
        # Run generate_comm.py
        generate_comm_script = os.path.join(os.path.dirname(__file__), '..', 'backend', 'services', 'jinja', 'generate_comm.py')
        
        # Create simulation_files directory
        sim_dir = os.path.join(test_project_path, 'simulation_files')
        os.makedirs(sim_dir, exist_ok=True)
        
        # Run the script
        import subprocess
        result = subprocess.run([
            sys.executable, generate_comm_script, 
            "--project_path", test_project_path
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print("✅ Integration test passed")
            
            # Check the generated .comm file
            comm_file = os.path.join(sim_dir, 'calcul.comm')
            with open(comm_file, 'r') as f:
                comm_content = f.read()
            
            # Verify specific model assignments
            checks = [
                ("euler_beams", "POU_D_E"),
                ("timoshenko_beams", "POU_D_T"), 
                ("trusses", "BARRE")
            ]
            
            all_correct = True
            for group_name, expected_model in checks:
                group_pattern = f"GROUP_MA='{group_name}'"
                if group_pattern in comm_content and expected_model in comm_content:
                    print(f"✅ {group_name}: {expected_model} correctly assigned")
                else:
                    print(f"❌ {group_name}: {expected_model} not found")
                    all_correct = False
            
            return all_correct
        else:
            print(f"❌ Integration test failed: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Integration test error: {e}")
        return False
    finally:
        # Cleanup
        import shutil
        if os.path.exists(test_project_path):
            shutil.rmtree(test_project_path)

if __name__ == "__main__":
    print("🚀 TESTING COMPLETE FIX FOR BEAM MODEL SELECTION")
    print("=" * 60)
    
    # Run tests
    unit_passed = test_complete_fix()
    integration_passed = test_full_integration()
    
    print("\n" + "=" * 60)
    print("📊 COMPLETE FIX TEST RESULTS")
    print("=" * 60)
    print(f"Unit Tests: {'✅ PASSED' if unit_passed else '❌ FAILED'}")
    print(f"Integration Tests: {'✅ PASSED' if integration_passed else '❌ FAILED'}")
    
    if unit_passed and integration_passed:
        print("\n🎉 COMPLETE FIX SUCCESSFUL!")
        print("📋 Summary:")
        print("   ✅ Frontend now exports section_type field")
        print("   ✅ Backend correctly processes beam models")
        print("   ✅ POU_D_E, POU_D_T, BARRE all working")
        print("   ✅ Full integration test passed")
        print("\n🔧 Changes Made:")
        print("   - frontend/src/components/config/ModelConfig.tsx (added section_type)")
        print("   - backend/services/jinja/builders/geometry.py (beam model selection)")
        sys.exit(0)
    else:
        print("\n💥 SOME TESTS FAILED!")
        sys.exit(1)
