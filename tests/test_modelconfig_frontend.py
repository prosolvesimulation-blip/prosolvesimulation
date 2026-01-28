#!/usr/bin/env python3
"""
Frontend ModelConfig unit tests
Tests phenomenum and element mapping logic
"""

import json
import sys
from pathlib import Path

# Add frontend path for testing
sys.path.insert(0, str(Path(__file__).parent.parent / "frontend" / "src"))

class MockModelConfig:
    """Mock version of ModelConfig for testing"""
    
    MODEL_OPTIONS = {
        '1D': [
            {'value': 'POU_D_T', 'label': 'Beam Timoshenko'},
            {'value': 'POU_D_E', 'label': 'Beam Euler'},
            {'value': 'BARRE', 'label': 'Truss/Bar'},
            {'value': 'CABLE', 'label': 'Cable'}
        ],
        '2D': [
            {'value': 'DKT', 'label': 'Plate DKT'},
            {'value': 'DST', 'label': 'Plate DST'},
            {'value': 'COQUE_3D', 'label': 'Shell 3D'},
            {'value': 'MEMBRANE', 'label': 'Membrane'},
            {'value': 'C_PLAN', 'label': 'Plane Strain'},
            {'value': 'D_PLAN', 'label': 'Plane Stress'},
            {'value': 'AXIS', 'label': 'Axisymmetric'}
        ],
        '3D': [
            {'value': '3D', 'label': 'Solid/Volume'}
        ]
    }
    
    def __init__(self):
        self.groups = []
        
    def detect_category(self, types_obj):
        """Replicate frontend category detection logic"""
        types = list(types_obj.keys())
        if any(t == 'Node' for t in types): 
            return 'Node'
        if any('HEXA' in t or 'TETRA' in t or 'PENTA' in t for t in types): 
            return '3D'
        if any('QUAD' in t or 'TRIA' in t for t in types): 
            return '2D'
        if any('SEG' in t for t in types): 
            return '1D'
        return '3D'
        
    def detect_default_model(self, category):
        """Replicate frontend default model selection"""
        if category == 'Node': 
            return 'Node'
        if category == '3D': 
            return '3D'
        if category == '2D': 
            return 'DKT'
        if category == '1D': 
            return 'POU_D_T'
        return '3D'
        
    def process_mesh_groups(self, mesh_data):
        """Process mesh groups like frontend ModelConfig"""
        loaded_groups = []
        
        for group_name, info in mesh_data.items():
            category = self.detect_category(info['types'])
            comp_str = ', '.join([f"{t}:{q}" for t, q in info['types'].items()])
            
            # Skip Node groups
            if category == 'Node':
                continue
                
            group = {
                'name': group_name,
                'selected': True,
                'count': info['count'],
                'composition': comp_str,
                'category': category,
                'model': self.detect_default_model(category),
                'phenomenon': 'MECANIQUE'  # This is the key test point
            }
            loaded_groups.append(group)
            
        self.groups = loaded_groups
        return loaded_groups
        
    def export_to_geometries(self):
        """Export to geometry format like frontend"""
        return [
            {
                'group': g['name'],
                'type': g['model'],
                'phenomenon': g['phenomenon'],
                '_category': g['category']
            }
            for g in self.groups if g['selected']
        ]

class ModelConfigFrontendTests:
    def __init__(self):
        self.test_results = []
        
    def test_category_detection(self):
        """Test mesh group category detection"""
        test_cases = [
            ({"SEG2": 100}, "1D"),
            ({"QUAD4": 50}, "2D"),
            ({"HEXA8": 200}, "3D"),
            ({"SEG2": 50, "SEG3": 25}, "1D"),
            ({"QUAD4": 30, "TRIA3": 20}, "2D"),
            ({"HEXA8": 100, "TETRA4": 50}, "3D"),
            ({"Node": 10}, "Node")
        ]
        
        model_config = MockModelConfig()
        passed = 0
        
        for types, expected_category in test_cases:
            detected = model_config.detect_category(types)
            if detected == expected_category:
                passed += 1
            else:
                self.test_results.append({
                    "test": "category_detection",
                    "input": types,
                    "expected": expected_category,
                    "actual": detected,
                    "passed": False
                })
                
        print(f"Category Detection: {passed}/{len(test_cases)} passed")
        return passed == len(test_cases)
        
    def test_default_model_selection(self):
        """Test default model selection for each category"""
        test_cases = [
            ("1D", "POU_D_T"),
            ("2D", "DKT"),
            ("3D", "3D"),
            ("Node", "Node")
        ]
        
        model_config = MockModelConfig()
        passed = 0
        
        for category, expected_model in test_cases:
            selected = model_config.detect_default_model(category)
            if selected == expected_model:
                passed += 1
            else:
                self.test_results.append({
                    "test": "default_model_selection",
                    "input": category,
                    "expected": expected_model,
                    "actual": selected,
                    "passed": False
                })
                
        print(f"Default Model Selection: {passed}/{len(test_cases)} passed")
        return passed == len(test_cases)
        
    def test_phenomenum_assignment(self):
        """Test that phenomenum is always set to MECANIQUE"""
        test_mesh_data = {
            "Beam_Group": {"types": {"SEG2": 100}, "count": 100},
            "Shell_Group": {"types": {"QUAD4": 50}, "count": 50},
            "Solid_Group": {"types": {"HEXA8": 200}, "count": 200}
        }
        
        model_config = MockModelConfig()
        groups = model_config.process_mesh_groups(test_mesh_data)
        geometries = model_config.export_to_geometries()
        
        passed = 0
        for geometry in geometries:
            if geometry.get('phenomenon') == 'MECANIQUE':
                passed += 1
            else:
                self.test_results.append({
                    "test": "phenomenum_assignment",
                    "group": geometry['group'],
                    "expected": "MECANIQUE",
                    "actual": geometry.get('phenomenon'),
                    "passed": False
                })
                
        print(f"Phenomenum Assignment: {passed}/{len(geometries)} passed")
        return passed == len(geometries)
        
    def test_element_type_mapping(self):
        """Test element type mapping for all categories"""
        test_cases = [
            # 1D elements
            ({"SEG2": 50}, "1D", "POU_D_T"),
            ({"SEG3": 50}, "1D", "POU_D_T"),
            
            # 2D elements  
            ({"QUAD4": 50}, "2D", "DKT"),
            ({"TRIA3": 50}, "2D", "DKT"),
            
            # 3D elements
            ({"HEXA8": 100}, "3D", "3D"),
            ({"TETRA4": 100}, "3D", "3D"),
        ]
        
        model_config = MockModelConfig()
        passed = 0
        
        for types, category, expected_model in test_cases:
            mesh_data = {"Test_Group": {"types": types, "count": 100}}
            groups = model_config.process_mesh_groups(mesh_data)
            
            if groups and groups[0]['model'] == expected_model:
                passed += 1
            else:
                actual_model = groups[0]['model'] if groups else "None"
                self.test_results.append({
                    "test": "element_type_mapping",
                    "input": types,
                    "expected": expected_model,
                    "actual": actual_model,
                    "passed": False
                })
                
        print(f"Element Type Mapping: {passed}/{len(test_cases)} passed")
        return passed == len(test_cases)
        
    def test_geometry_export_format(self):
        """Test geometry export format matches backend expectations"""
        test_mesh_data = {
            "Test_Beam": {"types": {"SEG2": 50}, "count": 50},
            "Test_Shell": {"types": {"QUAD4": 25}, "count": 25}
        }
        
        model_config = MockModelConfig()
        groups = model_config.process_mesh_groups(test_mesh_data)
        geometries = model_config.export_to_geometries()
        
        # Validate required fields
        required_fields = ['group', 'type', 'phenomenon']
        passed = 0
        
        for geometry in geometries:
            if all(field in geometry for field in required_fields):
                if geometry['phenomenon'] == 'MECANIQUE':
                    passed += 1
                else:
                    self.test_results.append({
                        "test": "geometry_export_format",
                        "group": geometry['group'],
                        "error": "Wrong phenomenum",
                        "passed": False
                    })
            else:
                missing = [f for f in required_fields if f not in geometry]
                self.test_results.append({
                    "test": "geometry_export_format", 
                    "group": geometry['group'],
                    "error": f"Missing fields: {missing}",
                    "passed": False
                })
                
        print(f"Geometry Export Format: {passed}/{len(geometries)} passed")
        return passed == len(geometries)
        
    def run_all_tests(self):
        """Run all frontend tests"""
        print("Running ModelConfig Frontend Tests...")
        print("=" * 50)
        
        tests = [
            self.test_category_detection,
            self.test_default_model_selection,
            self.test_phenomenum_assignment,
            self.test_element_type_mapping,
            self.test_geometry_export_format
        ]
        
        passed_tests = 0
        for test in tests:
            if test():
                passed_tests += 1
            print()
            
        print("=" * 50)
        print(f"Frontend Tests: {passed_tests}/{len(tests)} passed")
        
        if self.test_results:
            print("\nFailed Tests:")
            for result in self.test_results:
                print(f"  {result['test']}: {result}")
                
        return passed_tests == len(tests)

def main():
    """Main test execution"""
    tester = ModelConfigFrontendTests()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
