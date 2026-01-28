#!/usr/bin/env python3
"""
Master test runner for ModelConfig and .comm generation
Runs all test suites and generates comprehensive report
"""

import sys
import json
import time
from pathlib import Path
from datetime import datetime

# Import test modules
from test_modelconfig_frontend import ModelConfigFrontendTests
from test_modelconfig_comm_generation import ModelConfigTester
from test_comm_validation import CommValidator

class TestRunner:
    def __init__(self):
        self.results = {}
        self.start_time = time.time()
        
    def run_frontend_tests(self):
        """Run frontend ModelConfig tests"""
        print("Running Frontend Tests...")
        print("-" * 40)
        
        tester = ModelConfigFrontendTests()
        success = tester.run_all_tests()
        
        self.results['frontend'] = {
            'passed': success,
            'errors': tester.test_results,
            'execution_time': time.time() - self.start_time
        }
        
        return success
        
    def run_integration_tests(self, max_tests=20):
        """Run integration tests (ModelConfig → .comm generation)"""
        print("Running Integration Tests...")
        print("-" * 40)
        
        tester = ModelConfigTester()
        tester.run_all_tests(max_tests=max_tests)
        
        # Calculate success rate
        passed = sum(1 for r in tester.test_results if r['success'])
        total = len(tester.test_results)
        success_rate = passed / total if total > 0 else 0
        
        self.results['integration'] = {
            'passed': success_rate >= 0.9,  # 90% success rate threshold
            'success_rate': success_rate,
            'total_tests': total,
            'passed_tests': passed,
            'failed_tests': total - passed,
            'test_results': tester.test_results,
            'execution_time': time.time() - self.start_time
        }
        
        return success_rate >= 0.9
        
    def run_validation_tests(self):
        """Run .comm file validation tests"""
        print("Running Validation Tests...")
        print("-" * 40)
        
        validator = CommValidator()
        
        # Test with sample .comm files if they exist
        test_comm_files = list(Path(__file__).parent.parent.rglob("*.comm"))
        
        if not test_comm_files:
            print("No .comm files found for validation testing")
            self.results['validation'] = {
                'passed': True,
                'message': 'No .comm files to validate',
                'execution_time': time.time() - self.start_time
            }
            return True
            
        validation_results = []
        for comm_file in test_comm_files[:5]:  # Limit to 5 files
            # Create sample expected assignments
            sample_assignments = [
                {'group': 'Test_Group', 'type': 'POU_D_T'}
            ]
            
            result = validator.comprehensive_validate(str(comm_file), sample_assignments)
            validation_results.append(result)
            
        passed_validations = sum(1 for r in validation_results if r['overall_passed'])
        success_rate = passed_validations / len(validation_results) if validation_results else 1.0
        
        self.results['validation'] = {
            'passed': success_rate >= 0.8,  # 80% success rate threshold
            'success_rate': success_rate,
            'files_tested': len(validation_results),
            'passed_files': passed_validations,
            'validation_results': validation_results,
            'execution_time': time.time() - self.start_time
        }
        
        return success_rate >= 0.8
        
    def generate_comprehensive_report(self):
        """Generate comprehensive test report"""
        total_time = time.time() - self.start_time
        
        report = [
            "COMPREHENSIVE MODELCONFIG/.COMM TEST REPORT",
            "=" * 60,
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"Total Execution Time: {total_time:.2f} seconds",
            ""
        ]
        
        # Summary
        all_passed = all(result['passed'] for result in self.results.values())
        report.append(f"OVERALL RESULT: {'✓ PASSED' if all_passed else '✗ FAILED'}")
        report.append("")
        
        # Individual test suite results
        for suite_name, result in self.results.items():
            status = "✓ PASSED" if result['passed'] else "✗ FAILED"
            report.append(f"{suite_name.upper()}: {status}")
            
            if 'success_rate' in result:
                report.append(f"  Success Rate: {result['success_rate']*100:.1f}%")
            if 'total_tests' in result:
                report.append(f"  Tests: {result['passed_tests']}/{result['total_tests']}")
            if 'execution_time' in result:
                report.append(f"  Time: {result['execution_time']:.2f}s")
            report.append("")
            
        # Detailed failures
        report.append("DETAILED FAILURES:")
        report.append("-" * 30)
        
        for suite_name, result in self.results.items():
            if not result['passed']:
                report.append(f"\n{suite_name.upper()} FAILURES:")
                
                if suite_name == 'frontend':
                    for error in result.get('errors', []):
                        report.append(f"  - {error}")
                        
                elif suite_name == 'integration':
                    failed_tests = [r for r in result.get('test_results', []) if not r['success']]
                    for test in failed_tests[:5]:  # Limit to first 5 failures
                        report.append(f"  Test {test['test_id']}: {test['mesh_groups']}")
                        for error in test['errors'][:2]:  # Limit errors per test
                            report.append(f"    - {error}")
                            
                elif suite_name == 'validation':
                    failed_validations = [r for r in result.get('validation_results', []) 
                                        if not r['overall_passed']]
                    for validation in failed_validations[:3]:  # Limit to first 3
                        report.append(f"  File: {validation['file_path']}")
                        report.append(f"    Errors: {validation['total_errors']}")
                        
        # Recommendations
        report.append("\nRECOMMENDATIONS:")
        report.append("-" * 20)
        
        if not self.results.get('frontend', {}).get('passed'):
            report.append("- Fix frontend ModelConfig phenomenum/element mapping")
            
        if not self.results.get('integration', {}).get('passed'):
            report.append("- Review .comm generation pipeline")
            report.append("- Check geometry.json format compatibility")
            
        if not self.results.get('validation', {}).get('passed'):
            report.append("- Fix .comm file syntax or structure issues")
            
        if all_passed:
            report.append("- All tests passed! System is ready for production.")
            
        # Save report
        report_text = "\n".join(report)
        report_file = Path(__file__).parent / f"comprehensive_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        with open(report_file, 'w') as f:
            f.write(report_text)
            
        # Save JSON results
        json_file = Path(__file__).parent / f"test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(json_file, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)
            
        print(report_text)
        print(f"\nDetailed report saved to: {report_file}")
        print(f"JSON results saved to: {json_file}")
        
        return all_passed
        
    def run_all_tests(self, integration_max_tests=20):
        """Run all test suites"""
        print("STARTING COMPREHENSIVE MODELCONFIG/.COMM TEST SUITE")
        print("=" * 60)
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        try:
            # Run individual test suites
            frontend_ok = self.run_frontend_tests()
            print()
            
            integration_ok = self.run_integration_tests(max_tests=integration_max_tests)
            print()
            
            validation_ok = self.run_validation_tests()
            print()
            
            # Generate comprehensive report
            all_passed = frontend_ok and integration_ok and validation_ok
            self.generate_comprehensive_report()
            
            return all_passed
            
        except Exception as e:
            print(f"Test execution error: {str(e)}")
            return False

def main():
    """Main execution"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Run ModelConfig/.comm test suite")
    parser.add_argument("--max-integration-tests", type=int, default=20,
                       help="Maximum integration tests to run")
    parser.add_argument("--frontend-only", action="store_true",
                       help="Run only frontend tests")
    parser.add_argument("--integration-only", action="store_true", 
                       help="Run only integration tests")
    parser.add_argument("--validation-only", action="store_true",
                       help="Run only validation tests")
    
    args = parser.parse_args()
    
    runner = TestRunner()
    
    if args.frontend_only:
        success = runner.run_frontend_tests()
        runner.generate_comprehensive_report()
    elif args.integration_only:
        success = runner.run_integration_tests(max_tests=args.max_integration_tests)
        runner.generate_comprehensive_report()
    elif args.validation_only:
        success = runner.run_validation_tests()
        runner.generate_comprehensive_report()
    else:
        success = runner.run_all_tests(integration_max_tests=args.max_integration_tests)
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
