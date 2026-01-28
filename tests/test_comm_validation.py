#!/usr/bin/env python3
"""
.comm file validation utilities
Parse and validate phenomenum and element correctness in generated files
"""

import re
import json
from pathlib import Path
from typing import Dict, List, Tuple, Optional

class CommValidator:
    """Validates Code_Aster .comm files for phenomenum and element correctness"""
    
    def __init__(self):
        self.affe_modele_pattern = re.compile(r'MODELE=AFFE_MODELE\(.*?\)', re.DOTALL)
        self.cara_elem_pattern = re.compile(r'CARA_ELEM=AFFE_CARA_ELEM\(.*?\)', re.DOTALL)
        self.phenomenum_pattern = re.compile(r'PHENOMENE=\'([^\']+)\'')
        self.group_pattern = re.compile(r'GROUP_MA=\'([^\']+)\'')
        self.modelisation_pattern = re.compile(r'MODELISATION=\'([^\']+)\'')
        
    def parse_comm_file(self, file_path: str) -> Dict:
        """Parse .comm file and extract key sections"""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        parsed = {
            'affe_modele_commands': [],
            'cara_elem_commands': [],
            'phenomena': set(),
            'groups': set(),
            'modelisations': {}
        }
        
        # Extract AFFE_MODELE commands
        for match in self.affe_modele_pattern.finditer(content):
            command = match.group(0)
            phenomenum_match = self.phenomenum_pattern.search(command)
            group_matches = self.group_pattern.findall(command)
            modelisation_match = self.modelisation_pattern.search(command)
            
            cmd_data = {
                'command': command,
                'phenomenum': phenomenum_match.group(1) if phenomenum_match else None,
                'groups': group_matches,
                'modelisation': modelisation_match.group(1) if modelisation_match else None
            }
            
            parsed['affe_modele_commands'].append(cmd_data)
            
            if phenomenum_match:
                parsed['phenomena'].add(phenomenum_match.group(1))
            parsed['groups'].update(group_matches)
            
        # Extract CARA_ELEM commands
        for match in self.cara_elem_pattern.finditer(content):
            command = match.group(0)
            parsed['cara_elem_commands'].append({'command': command})
            
        return parsed
        
    def validate_phenomenum(self, parsed_comm: Dict, expected_phenomenum: str = 'MECANIQUE') -> Tuple[bool, List[str]]:
        """Validate phenomenum is correctly set"""
        errors = []
        
        if not parsed_comm['phenomena']:
            errors.append("No phenomenum found in any AFFE_MODELE command")
            return False, errors
            
        for phenomenum in parsed_comm['phenomena']:
            if phenomenum != expected_phenomenum:
                errors.append(f"Wrong phenomenum: found '{phenomenum}', expected '{expected_phenomenum}'")
                
        return len(errors) == 0, errors
        
    def validate_element_assignments(self, parsed_comm: Dict, expected_assignments: List[Dict]) -> Tuple[bool, List[str]]:
        """Validate element assignments match expectations"""
        errors = []
        
        # Create mapping of groups to expected modelisations
        expected_mapping = {assign['group']: assign['type'] for assign in expected_assignments}
        
        # Check each AFFE_MODELE command
        for cmd in parsed_comm['affe_modele_commands']:
            for group in cmd['groups']:
                if group not in expected_mapping:
                    errors.append(f"Unexpected group in AFFE_MODELE: {group}")
                    continue
                    
                expected_model = expected_mapping[group]
                actual_model = cmd['modelisation']
                
                if actual_model != expected_model:
                    errors.append(f"Group {group}: expected model {expected_model}, got {actual_model}")
                    
        # Check for missing groups
        found_groups = set()
        for cmd in parsed_comm['affe_modele_commands']:
            found_groups.update(cmd['groups'])
            
        missing_groups = set(expected_mapping.keys()) - found_groups
        for group in missing_groups:
            errors.append(f"Missing group in AFFE_MODELE: {group}")
            
        return len(errors) == 0, errors
        
    def validate_cara_elem(self, parsed_comm: Dict, expected_assignments: List[Dict]) -> Tuple[bool, List[str]]:
        """Validate CARA_ELEM commands for shells/beams"""
        errors = []
        
        # Check for required CARA_ELEM based on element types
        shell_beam_types = ['DKT', 'DST', 'COQUE_3D', 'POU_D_T', 'POU_D_E', 'BARRE']
        needs_cara_elem = [assign for assign in expected_assignments 
                          if assign['type'] in shell_beam_types]
        
        if needs_cara_elem and not parsed_comm['cara_elem_commands']:
            errors.append("CARA_ELEM commands missing for shell/beam elements")
            return False, errors
            
        # Validate CARA_ELEM content
        for cmd in parsed_comm['cara_elem_commands']:
            command = cmd['command']
            
            # Check for COQUE (shells)
            shell_assignments = [a for a in expected_assignments 
                                if a['type'] in ['DKT', 'DST', 'COQUE_3D']]
            if shell_assignments and 'COQUE' not in command:
                errors.append("CARA_ELEM missing COQUE definition for shell elements")
                
            # Check for POUTRE (beams)
            beam_assignments = [a for a in expected_assignments 
                               if a['type'] in ['POU_D_T', 'POU_D_E', 'BARRE']]
            if beam_assignments and 'POUTRE' not in command:
                errors.append("CARA_ELEM missing POUTRE definition for beam elements")
                
        return len(errors) == 0, errors
        
    def validate_syntax(self, file_path: str) -> Tuple[bool, List[str]]:
        """Basic syntax validation"""
        errors = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Check for required sections
            required_sections = ['DEBUT', 'FIN']
            for section in required_sections:
                if section not in content:
                    errors.append(f"Missing required section: {section}")
                    
            # Check bracket matching
            open_parens = content.count('(')
            close_parens = content.count(')')
            if open_parens != close_parens:
                errors.append(f"Unmatched parentheses: {open_parens} open, {close_parens} close")
                
        except Exception as e:
            errors.append(f"File read error: {str(e)}")
            
        return len(errors) == 0, errors
        
    def comprehensive_validate(self, file_path: str, expected_assignments: List[Dict]) -> Dict:
        """Run comprehensive validation"""
        results = {
            'file_path': file_path,
            'total_errors': 0,
            'validations': {}
        }
        
        # Parse the file
        try:
            parsed = self.parse_comm_file(file_path)
        except Exception as e:
            results['parse_error'] = str(e)
            results['total_errors'] = 1
            return results
            
        # Syntax validation
        syntax_ok, syntax_errors = self.validate_syntax(file_path)
        results['validations']['syntax'] = {
            'passed': syntax_ok,
            'errors': syntax_errors
        }
        results['total_errors'] += len(syntax_errors)
        
        # Phenomenum validation
        phenom_ok, phenom_errors = self.validate_phenomenum(parsed)
        results['validations']['phenomenum'] = {
            'passed': phenom_ok,
            'errors': phenom_errors
        }
        results['total_errors'] += len(phenom_errors)
        
        # Element assignment validation
        elem_ok, elem_errors = self.validate_element_assignments(parsed, expected_assignments)
        results['validations']['element_assignments'] = {
            'passed': elem_ok,
            'errors': elem_errors
        }
        results['total_errors'] += len(elem_errors)
        
        # CARA_ELEM validation
        cara_ok, cara_errors = self.validate_cara_elem(parsed, expected_assignments)
        results['validations']['cara_elem'] = {
            'passed': cara_ok,
            'errors': cara_errors
        }
        results['total_errors'] += len(cara_errors)
        
        results['overall_passed'] = results['total_errors'] == 0
        results['parsed_data'] = {
            'groups_found': list(parsed['groups']),
            'phenomena_found': list(parsed['phenomena']),
            'affe_modele_count': len(parsed['affe_modele_commands']),
            'cara_elem_count': len(parsed['cara_elem_commands'])
        }
        
        return results
        
    def generate_validation_report(self, validation_results: List[Dict]) -> str:
        """Generate detailed validation report"""
        total_files = len(validation_results)
        passed_files = sum(1 for r in validation_results if r['overall_passed'])
        
        report = [
            "COMM FILE VALIDATION REPORT",
            "=" * 50,
            f"Total Files: {total_files}",
            f"Passed: {passed_files}",
            f"Failed: {total_files - passed_files}",
            f"Success Rate: {passed_files/total_files*100:.1f}%",
            ""
        ]
        
        # Summary of validation types
        validation_types = ['syntax', 'phenomenum', 'element_assignments', 'cara_elem']
        for vtype in validation_types:
            passed = sum(1 for r in validation_results 
                        if r['validations'][vtype]['passed'])
            report.append(f"{vtype}: {passed}/{total_files} passed")
            
        report.append("\n" + "FAILED FILES:" + "\n" + "-" * 30)
        
        for result in validation_results:
            if not result['overall_passed']:
                report.append(f"\nFile: {result['file_path']}")
                report.append(f"Total Errors: {result['total_errors']}")
                
                for vtype, validation in result['validations'].items():
                    if not validation['passed']:
                        report.append(f"  {vtype}:")
                        for error in validation['errors']:
                            report.append(f"    - {error}")
                            
        return "\n".join(report)

def main():
    """Test the validator with sample data"""
    validator = CommValidator()
    
    # Sample validation
    sample_assignments = [
        {'group': 'Beam_Group', 'type': 'POU_D_T'},
        {'group': 'Shell_Group', 'type': 'DKT'}
    ]
    
    # This would be used with actual .comm files
    print("CommValidator ready for use")
    print("Usage: validator.comprehensive_validate(file_path, expected_assignments)")

if __name__ == "__main__":
    main()
