#!/usr/bin/env python3
"""
Comprehensive test suite for ModelConfig and .comm generation
Tests all phenomenum and element combinations from modelOptions.json
"""

import json
import sys
import os
import tempfile
import shutil
from pathlib import Path
import itertools
import random

# Add backend paths
sys.path.insert(0, str(Path(__file__).parent.parent / "backend" / "services" / "jinja"))
sys.path.insert(0, str(Path(__file__).parent.parent / "backend" / "services" / "jinja" / "builders"))

# Import the modules we need to test
from geometry import build_geometry
from affe_modele import build_affe_modele

class ModelConfigTester:
    def __init__(self):
        self.base_dir = Path(__file__).parent.parent
        self.model_options_file = self.base_dir / "frontend" / "src" / "data" / "modelOptions.json"
        self.test_results = []
        self.temp_dir = None
        
    def setup_test_environment(self):
        """Create temporary test directories"""
        self.temp_dir = tempfile.mkdtemp(prefix="modelconfig_test_")
        self.sim_dir = Path(self.temp_dir) / "simulation_files"
        self.sim_dir.mkdir(exist_ok=True)
        
    def cleanup_test_environment(self):
        """Clean up temporary directories"""
        if self.temp_dir and os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
            
    def load_model_options(self):
        """Load all model options from JSON file"""
        with open(self.model_options_file, 'r') as f:
            return json.load(f)
            
    def generate_mesh_combinations(self):
        """Generate realistic mesh group combinations"""
        combinations = []
        
        # Single group tests
        single_groups = [
            {"Beam_Group": {"types": {"SEG2": 100}, "count": 100, "category": "1D"}},
            {"Shell_Group": {"types": {"QUAD4": 50}, "count": 50, "category": "2D"}},
            {"Solid_Group": {"types": {"HEXA8": 200}, "count": 200, "category": "3D"}},
            {"Mixed_1D": {"types": {"SEG2": 50, "SEG3": 25}, "count": 75, "category": "1D"}},
            {"Mixed_2D": {"types": {"QUAD4": 30, "TRIA3": 20}, "count": 50, "category": "2D"}},
            {"Mixed_3D": {"types": {"HEXA8": 100, "TETRA4": 50}, "count": 150, "category": "3D"}},
        ]
        
        for group in single_groups:
            combinations.append({"mesh_groups": group})
            
        # Multi-group tests
        multi_groups = [
            {"Beam1": {"types": {"SEG2": 50}, "count": 50, "category": "1D"},
             "Shell1": {"types": {"QUAD4": 25}, "count": 25, "category": "2D"}},
            
            {"Beam1": {"types": {"SEG2": 30}, "count": 30, "category": "1D"},
             "Shell1": {"types": {"QUAD4": 20}, "count": 20, "category": "2D"},
             "Solid1": {"types": {"HEXA8": 40}, "count": 40, "category": "3D"}},
             
            {"Beam1": {"types": {"SEG2": 25}, "count": 25, "category": "1D"},
             "Beam2": {"types": {"SEG3": 25}, "count": 25, "category": "1D"},
             "Shell1": {"types": {"QUAD4": 30}, "count": 30, "category": "2D"}},
        ]
        
        for groups in multi_groups:
            combinations.append({"mesh_groups": groups})
            
        return combinations
        
    def simulate_modelconfig_selection(self, mesh_groups, model_options):
        """Simulate ModelConfig user selections"""
        geometries = []
        
        for group_name, group_info in mesh_groups.items():
            category = group_info["category"]
            
            # Get available models for this category
            available_models = []
            for app in model_options:
                if category in app["models"]:
                    available_models = app["models"][category]
                    break
                    
            if not available_models:
                continue
                
            # Randomly select a model (like user would)
            selected_model = random.choice(available_models)
            
            geometry = {
                "group": group_name,
                "type": selected_model["value"],
                "phenomenon": app["application"],  # Use the application as phenomenon
                "_category": category,
                "selected": True
            }
            
            # Add section properties for beams/shells if needed
            if selected_model["value"] in ["POU_D_T", "POU_D_E", "DKT", "DST", "COQUE_3D"]:
                geometry["section_params"] = {
                    "thickness": 5.0 if category == "2D" else None,
                    "hy": 100.0 if category == "1D" else None,
                    "hz": 50.0 if category == "1D" else None,
                }
                
            geometries.append(geometry)
            
        return geometries
        
    def create_test_project(self, mesh_groups, geometries):
        """Create test project.json file"""
        project_data = {
            "name": "Test Project",
            "meshes": [
                {
                    "name": "TEST_MESH",
                    "filename": "test_mesh.med",
                    "unit": 20
                }
            ],
            "geometries": geometries,
            "materials": [
                {
                    "name": "Steel",
                    "young_modulus": 210000,
                    "poisson_ratio": 0.3,
                    "density": 7.8e-9,
                    "assignedGroups": [geom["group"] for geom in geometries]
                }
            ],
            "restrictions": [],
            "load_cases": [],
            "loads": []
        }
        
        project_file = self.sim_dir / "project.json"
        with open(project_file, 'w') as f:
            json.dump(project_data, f, indent=2)
            
        return project_file
        
    def generate_comm_file(self):
        """Generate .comm file using the backend script"""
        try:
            # Ensure project.json exists before calling generate_comm
            project_file = self.sim_dir / "project.json"
            if not project_file.exists():
                return False, "project.json not found - test setup failed"
                
            # Call the generate_comm.py script with our test project path
            import subprocess
            result = subprocess.run([
                sys.executable, 
                str(self.base_dir / "backend" / "services" / "jinja" / "generate_comm.py"),
                "--project_path", str(self.sim_dir)
            ], capture_output=True, text=True, cwd=self.sim_dir)
            
            if result.returncode != 0:
                return False, result.stderr
                
            comm_file = self.sim_dir / "calcul.comm"
            if not comm_file.exists():
                return False, "comm file not generated"
                
            return True, comm_file.read_text()
            
        except Exception as e:
            return False, str(e)
            
    def validate_comm_output(self, comm_content, geometries):
        """Validate phenomenum and element correctness in .comm file"""
        errors = []
        
        # Check phenomenum in AFFE_MODELE commands
        for geometry in geometries:
            group_name = geometry["group"]
            expected_phenomenon = geometry["phenomenon"]
            expected_model = geometry["type"]
            
            # Look for AFFE_MODELE command for this group
            affe_modele_pattern = f"MODELE=AFFE_MODELE"
            if affe_modele_pattern not in comm_content:
                errors.append(f"No AFFE_MODELE command found")
                continue
                
            # Check phenomenum
            if expected_phenomenon not in comm_content:
                errors.append(f"Phenomenon {expected_phenomenon} not found in .comm")
                
            # Check model assignment
            if f"F_IMPR_MAIL=_F(GROUP_MA='{group_name}'" not in comm_content:
                errors.append(f"Group {group_name} not found in AFFE_MODELE")
                
        # Validate CARA_ELEM for shells/beams
        for geometry in geometries:
            if geometry["type"] in ["DKT", "DST", "COQUE_3D"]:
                if "COQUE" not in comm_content:
                    errors.append(f"Shell element COQUE not found for {geometry['type']}")
                    
            elif geometry["type"] in ["POU_D_T", "POU_D_E", "BARRE"]:
                if "POUTRE" not in comm_content:
                    errors.append(f"Beam element POUTRE not found for {geometry['type']}")
                    
        return len(errors) == 0, errors
        
    def run_single_test(self, mesh_combination, model_options):
        """Run a single test case"""
        test_name = f"Test_{len(self.test_results) + 1}"
        
        try:
            # 1. Simulate ModelConfig selections
            geometries = self.simulate_modelconfig_selection(
                mesh_combination["mesh_groups"], 
                model_options
            )
            
            if not geometries:
                return False, ["No geometries generated"]
                
            # 2. Create test project
            self.create_test_project(mesh_combination["mesh_groups"], geometries)
            
            # 3. Generate .comm file
            success, comm_content = self.generate_comm_file()
            if not success:
                return False, [f"Failed to generate .comm: {comm_content}"]
                
            # 4. Validate output
            is_valid, errors = self.validate_comm_output(comm_content, geometries)
            
            return is_valid, errors
            
        except Exception as e:
            return False, [f"Test execution error: {str(e)}"]
            
    def run_all_tests(self, max_tests=5):
        """Run comprehensive test suite"""
        print("Starting ModelConfig/.comm generation tests...")
        
        # Load model options
        model_options = self.load_model_options()
        
        # Generate test combinations
        mesh_combinations = self.generate_mesh_combinations()
        
        # Limit tests for practical execution
        if len(mesh_combinations) > max_tests:
            mesh_combinations = mesh_combinations[:max_tests]
            
        print(f"Running {len(mesh_combinations)} test cases...")
        
        # Setup test environment
        self.setup_test_environment()
        
        try:
            # Run each test
            for i, combination in enumerate(mesh_combinations):
                print(f"Test {i+1}/{len(mesh_combinations)}...", end=" ")
                
                success, errors = self.run_single_test(combination, model_options)
                
                result = {
                    "test_id": i + 1,
                    "mesh_groups": list(combination["mesh_groups"].keys()),
                    "success": success,
                    "errors": errors
                }
                
                self.test_results.append(result)
                
                if success:
                    print("✓ PASS")
                else:
                    print(f"✗ FAIL - {'; '.join(errors[:2])}")
                    
        finally:
            self.cleanup_test_environment()
            
        # Generate report
        self.generate_test_report()
        
    def generate_test_report(self):
        """Generate comprehensive test report"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results if r["success"])
        failed_tests = total_tests - passed_tests
        
        print("\n" + "="*60)
        print("MODELCONFIG/.COMM GENERATION TEST REPORT")
        print("="*60)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {passed_tests/total_tests*100:.1f}%")
        
        if failed_tests > 0:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  Test {result['test_id']}: {result['mesh_groups']}")
                    for error in result["errors"]:
                        print(f"    - {error}")
                        
        # Save detailed report
        report_file = Path(__file__).parent / "test_report.json"
        with open(report_file, 'w') as f:
            json.dump({
                "summary": {
                    "total": total_tests,
                    "passed": passed_tests,
                    "failed": failed_tests,
                    "success_rate": passed_tests/total_tests*100
                },
                "results": self.test_results
            }, f, indent=2)
            
        print(f"\nDetailed report saved to: {report_file}")

def main():
    """Main test execution"""
    tester = ModelConfigTester()
    tester.run_all_tests(max_tests=3)  # Small number for testing
    
if __name__ == "__main__":
    main()
