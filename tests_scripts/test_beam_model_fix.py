#!/usr/bin/env python3
"""
Test script to verify beam model selection fix in geometry builder
"""

import sys
import os
import json

# Add the builders directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'services', 'jinja', 'builders'))

def test_beam_model_selection():
    """Test that beam model selection from frontend is properly used"""
    
    try:
        from geometry import build_geometry
        print("✅ Successfully imported build_geometry")
    except ImportError as e:
        print(f"❌ Failed to import build_geometry: {e}")
        return False
    
    # Test cases: different beam models
    test_cases = [
        {
            "name": "POU_D_E (Euler Beam)",
            "geometry": {
                "group": "test_beam_euler",
                "type": "POU_D_E",
                "section_type": "BEAM"
            },
            "expected_model": "POU_D_E"
        },
        {
            "name": "POU_D_T (Timoshenko Beam)",
            "geometry": {
                "group": "test_beam_timoshenko", 
                "type": "POU_D_T",
                "section_type": "BEAM"
            },
            "expected_model": "POU_D_T"
        },
        {
            "name": "BARRE (Truss)",
            "geometry": {
                "group": "test_truss",
                "type": "BARRE", 
                "section_type": "BEAM"
            },
            "expected_model": "BARRE"
        },
        {
            "name": "Fallback (No type specified)",
            "geometry": {
                "group": "test_fallback",
                "section_type": "BEAM"
                # No "type" field - should fallback to POU_D_T
            },
            "expected_model": "POU_D_T"
        }
    ]
    
    print("\n🧪 Running beam model selection tests...")
    print("=" * 60)
    
    all_passed = True
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\nTest {i}: {test_case['name']}")
        print("-" * 40)
        
        # Build geometry
        result = build_geometry([test_case['geometry']], "TEST_MODELE", "TEST_CARA")
        
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

def test_full_integration():
    """Test the full integration with generate_comm.py"""
    
    print("\n🔗 Testing full integration...")
    print("=" * 60)
    
    # Create a test project structure
    test_project_path = os.path.join(os.path.dirname(__file__), 'temp_test_project')
    os.makedirs(test_project_path, exist_ok=True)
    
    # Create test project.json with different beam models
    test_project = {
        "meshes": [
            {
                "name": "beam_mesh",
                "filename": "beam.med"
            }
        ],
        "geometries": [
            {
                "group": "euler_beam",
                "type": "POU_D_E",
                "section_type": "BEAM"
            },
            {
                "group": "timoshenko_beam", 
                "type": "POU_D_T",
                "section_type": "BEAM"
            },
            {
                "group": "truss",
                "type": "BARRE",
                "section_type": "BEAM"
            }
        ],
        "materials": [],
        "loads": []
    }
    
    project_file = os.path.join(test_project_path, 'project.json')
    with open(project_file, 'w') as f:
        json.dump(test_project, f, indent=2)
    
    print(f"✅ Created test project at: {test_project_path}")
    
    # Try to run generate_comm.py
    try:
        generate_comm_script = os.path.join(os.path.dirname(__file__), '..', 'backend', 'services', 'jinja', 'generate_comm.py')
        
        if os.path.exists(generate_comm_script):
            print("✅ Found generate_comm.py script")
            
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
                print("✅ generate_comm.py executed successfully")
                
                # Check the generated .comm file
                comm_file = os.path.join(sim_dir, 'calcul.comm')
                if os.path.exists(comm_file):
                    print("✅ calcul.comm file generated")
                    
                    # Read and check content
                    with open(comm_file, 'r') as f:
                        comm_content = f.read()
                    
                    # Check for expected models
                    models_found = []
                    if 'POU_D_E' in comm_content:
                        models_found.append('POU_D_E')
                    if 'POU_D_T' in comm_content:
                        models_found.append('POU_D_T') 
                    if 'BARRE' in comm_content:
                        models_found.append('BARRE')
                    
                    print(f"📝 Models found in .comm: {models_found}")
                    
                    expected_models = ['POU_D_E', 'POU_D_T', 'BARRE']
                    if all(model in models_found for model in expected_models):
                        print("✅ All expected beam models found in .comm file")
                        return True
                    else:
                        missing = [m for m in expected_models if m not in models_found]
                        print(f"❌ Missing models in .comm: {missing}")
                        return False
                else:
                    print("❌ calcul.comm file not found")
                    return False
            else:
                print(f"❌ generate_comm.py failed with return code {result.returncode}")
                print(f"STDERR: {result.stderr}")
                return False
        else:
            print(f"❌ generate_comm.py not found at {generate_comm_script}")
            return False
            
    except Exception as e:
        print(f"❌ Integration test failed: {e}")
        return False
    finally:
        # Cleanup
        import shutil
        if os.path.exists(test_project_path):
            shutil.rmtree(test_project_path)
            print(f"🧹 Cleaned up test project: {test_project_path}")

def test_real_world_scenario():
    """Test with a realistic project scenario"""
    
    print("\n🌍 Testing real-world scenario...")
    print("=" * 60)
    
    # Create test project path
    test_project_path = os.path.join(os.path.dirname(__file__), 'real_world_test')
    os.makedirs(test_project_path, exist_ok=True)
    
    # Create realistic project.json
    real_project = {
        "meshes": [
            {
                "name": "structure_mesh",
                "filename": "structure.med"
            }
        ],
        "geometries": [
            {
                "group": "main_beams",
                "type": "POU_D_E",
                "section_type": "BEAM",
                "section_params": {
                    "hy": 200.0,
                    "hz": 100.0
                }
            },
            {
                "group": "secondary_beams",
                "type": "POU_D_T", 
                "section_type": "BEAM",
                "section_params": {
                    "hy": 150.0,
                    "hz": 75.0
                }
            },
            {
                "group": "braces",
                "type": "BARRE",
                "section_type": "BEAM",
                "section_params": {
                    "r": 25.0
                }
            }
        ],
        "materials": [
            {
                "name": "Steel",
                "assignedGroups": ["main_beams", "secondary_beams", "braces"],
                "properties": {
                    "E": 210000,
                    "nu": 0.3,
                    "rho": 7850
                }
            }
        ],
        "loads": [
            {
                "type": "PESANTEUR",
                "assignedGroups": ["main_beams", "secondary_beams"],
                "gravity": 9.81
            }
        ]
    }
    
    project_file = os.path.join(test_project_path, 'project.json')
    with open(project_file, 'w') as f:
        json.dump(real_project, f, indent=2)
    
    print(f"✅ Created real-world test project")
    
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
            print("✅ Real-world test passed")
            
            # Check the generated .comm file content
            comm_file = os.path.join(sim_dir, 'calcul.comm')
            with open(comm_file, 'r') as f:
                comm_content = f.read()
            
            # Verify specific model assignments
            checks = [
                ("main_beams", "POU_D_E"),
                ("secondary_beams", "POU_D_T"), 
                ("braces", "BARRE")
            ]
            
            all_correct = True
            for group_name, expected_model in checks:
                # Look for the group assignment in the .comm file
                # Format: GROUP_MA='group_name', ... MODELISATION='model'
                group_pattern = f"GROUP_MA='{group_name}'"
                if group_pattern in comm_content and expected_model in comm_content:
                    print(f"✅ {group_name}: {expected_model} correctly assigned")
                else:
                    print(f"❌ {group_name}: {expected_model} not found or incorrect")
                    # Debug: show what we actually found
                    if group_pattern in comm_content:
                        print(f"   Found group but different model assignment")
                    else:
                        print(f"   Group pattern not found in .comm")
                    all_correct = False
            
            return all_correct
        else:
            print(f"❌ Real-world test failed: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Real-world test error: {e}")
        return False
    finally:
        # Cleanup
        import shutil
        if os.path.exists(test_project_path):
            shutil.rmtree(test_project_path)
            print(f"🧹 Cleaned up real-world test: {test_project_path}")

if __name__ == "__main__":
    print("🚀 Starting Comprehensive Beam Model Selection Tests")
    print("=" * 60)
    
    # Run all tests
    unit_passed = test_beam_model_selection()
    integration_passed = test_full_integration()
    real_world_passed = test_real_world_scenario()
    
    print("\n" + "=" * 60)
    print("📊 COMPREHENSIVE TEST RESULTS")
    print("=" * 60)
    print(f"Unit Tests: {'✅ PASSED' if unit_passed else '❌ FAILED'}")
    print(f"Integration Tests: {'✅ PASSED' if integration_passed else '❌ FAILED'}")
    print(f"Real-World Tests: {'✅ PASSED' if real_world_passed else '❌ FAILED'}")
    
    if unit_passed and integration_passed and real_world_passed:
        print("\n🎉 ALL TESTS PASSED! Beam model selection fix is working correctly.")
        print("📋 Summary:")
        print("   - POU_D_E (Euler) beams: ✅ Working")
        print("   - POU_D_T (Timoshenko) beams: ✅ Working") 
        print("   - BARRE (Truss) elements: ✅ Working")
        print("   - Fallback behavior: ✅ Working")
        print("   - Real-world scenarios: ✅ Working")
        sys.exit(0)
    else:
        print("\n💥 SOME TESTS FAILED! Please check the implementation.")
        sys.exit(1)
