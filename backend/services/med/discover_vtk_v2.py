import sys
import os
import vtk
from vtk.util import numpy_support
import json

def discover():
    results = {
        "vtk_version": vtk.vtkVersion().GetVTKVersion(),
        "filters": {}
    }
    
    # Common filters for vector handling
    target_filters = [
        "vtkArrayCalculator",
        "vtkAssignAttribute",
        "vtkWarpVector",
        "vtkWarpScalar",
        "vtkCalculator",
        "vtkPythonCalculator"
    ]
    
    for f in target_filters:
        results["filters"][f] = hasattr(vtk, f)
        
    # Check for SetActiveVectors method in dataset attributes
    pd = vtk.vtkPolyData()
    results["SetActiveVectors_exists"] = hasattr(pd.GetPointData(), "SetActiveVectors")
    
    print("__JSON_START__")
    print(json.dumps(results, indent=2))
    print("__JSON_END__")

if __name__ == "__main__":
    discover()
