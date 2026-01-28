# ModelConfig and .comm Generation Test Suite

Comprehensive automated testing for phenomenum and element correctness in the ModelConfig → .comm generation workflow.

## Overview

This test suite validates that:
1. **Frontend ModelConfig** correctly assigns phenomenum='MECANIQUE' and element types
2. **Backend .comm generation** properly processes geometry data and generates correct Code_Aster commands
3. **End-to-end workflow** maintains data integrity from UI selection to final .comm file

## Test Structure

```
tests/
├── test_modelconfig_frontend.py      # Frontend unit tests
├── test_modelconfig_comm_generation.py  # Integration tests
├── test_comm_validation.py           # .comm file validation
├── run_all_tests.py                  # Master test runner
└── README.md                         # This file
```

## Test Coverage

### Frontend Tests (`test_modelconfig_frontend.py`)
- **Category Detection**: 1D/2D/3D mesh group classification
- **Default Model Selection**: Automatic element type assignment
- **Phenomenum Assignment**: Ensures 'MECANIQUE' is always set
- **Element Type Mapping**: Validates Code_Aster element type mapping
- **Geometry Export Format**: Checks backend compatibility

### Integration Tests (`test_modelconfig_comm_generation.py`)
- **Mesh Group Combinations**: Tests realistic mesh configurations
- **User Selection Simulation**: Mimics user choosing element types
- **Project Generation**: Creates test project.json files
- **.comm Generation**: Runs backend generation script
- **Output Validation**: Verifies phenomenum and elements in .comm

### Validation Tests (`test_comm_validation.py`)
- **Syntax Validation**: Basic .comm file syntax checking
- **Phenomenum Validation**: Ensures PHENOMENE='MECANIQUE' in AFFE_MODELE
- **Element Assignment Validation**: Checks correct element types per group
- **CARA_ELEM Validation**: Validates shell/beam element properties

## Running Tests

### Quick Start
```bash
# Run all tests with default settings
python run_all_tests.py

# Run with more integration tests
python run_all_tests.py --max-integration-tests 50

# Run only frontend tests
python run_all_tests.py --frontend-only

# Run only integration tests
python run_all_tests.py --integration-only

# Run only validation tests
python run_all_tests.py --validation-only
```

### Individual Test Suites
```bash
# Frontend tests only
python test_modelconfig_frontend.py

# Integration tests only (limited to 20 cases)
python test_modelconfig_comm_generation.py

# Validation utilities (no standalone tests)
python test_comm_validation.py
```

## Test Data

### Model Options Coverage
Tests cover all element types from `frontend/src/data/modelOptions.json`:

**1D Elements**: POU_D_T, POU_D_E, BARRE, CABLE, etc.
**2D Elements**: DKT, DST, COQUE_3D, MEMBRANE, etc.  
**3D Elements**: 3D, 3D_SI, etc.

### Mesh Group Combinations
- Single group tests (beam only, shell only, solid only)
- Multi-group tests (beam+shell, beam+shell+solid)
- Mixed element types within categories

## Validation Criteria

### Phenomenum Validation
- All AFFE_MODELE commands must include `PHENOMENE='MECANIQUE'`
- No missing phenomenum parameters
- Correct phenomenum for each element type

### Element Validation  
- 1D groups: POU_D_T/POU_D_E/BARRE/CABLE assignments
- 2D groups: DKT/DST/COQUE_3D/MEMBRANE assignments  
- 3D groups: 3D assignments
- Correct CARA_ELEM properties for shells/beams

### Integration Validation
- Frontend → Backend data flow integrity
- Template rendering accuracy
- Generated .comm syntactic correctness

## Reports

### Console Output
Real-time test progress with pass/fail indicators and error summaries.

### Detailed Reports
- **Text Report**: Human-readable comprehensive report
- **JSON Report**: Machine-readable results for CI/CD integration

### Report Locations
Reports are saved in the `tests/` directory with timestamps:
- `comprehensive_test_report_YYYYMMDD_HHMMSS.txt`
- `test_results_YYYYMMDD_HHMMSS.json`

## Success Thresholds

- **Frontend Tests**: 100% pass required
- **Integration Tests**: 90% pass rate acceptable
- **Validation Tests**: 80% pass rate acceptable
- **Overall**: All suites must meet minimum thresholds

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure backend paths are correctly added to sys.path
2. **Missing Templates**: Check Jinja templates exist in backend/services/jinja/templates/
3. **Permission Errors**: Ensure write access to tests/ directory for report generation
4. **Module Not Found**: Install required dependencies (jinja2, etc.)

### Debug Mode
Add print statements or use Python debugger to inspect:
- Mesh group data structure
- Geometry export format
- Generated .comm content
- Validation parsing results

## Extending Tests

### Adding New Element Types
1. Update `MODEL_OPTIONS` in test files
2. Add corresponding mesh group test cases
3. Update validation patterns if needed

### Adding New Test Cases
1. Add mesh combinations to `generate_mesh_combinations()`
2. Update expected results in validation functions
3. Adjust success thresholds if needed

## CI/CD Integration

The test suite is designed for automated execution:

```bash
# In CI pipeline
python tests/run_all_tests.py --max-integration-tests 100
exit_code=$?
if [ $exit_code -eq 0 ]; then
    echo "All tests passed"
else
    echo "Some tests failed - check reports"
    exit 1
fi
```

## Performance

- **Frontend Tests**: < 1 second
- **Integration Tests**: ~2-5 seconds per test case
- **Validation Tests**: < 1 second per .comm file

Typical full suite execution: 1-2 minutes with default settings.
