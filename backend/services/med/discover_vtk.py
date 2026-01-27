import sys
import os
import vtk
import json

def discover():
    results = {}
    
    # 1. Search for typical vector filters
    filters = [
        "vtkArrayCalculator",
        "vtkAssignAttribute",
        "vtkWarpScalar",
        "vtkWarpVector",
        "vtkGeometryFilter",
        "vtkProgrammableFilter",
        "vtkPythonCalculator"
    ]
    
    results["filters_available"] = {f: hasattr(vtk, f) for f in filters}
    
    # 2. Inspect vtkDataSetAttributes (PointData/CellData attributes)
    results["dataset_attributes"] = [a for a in dir(vtk.vtkDataSetAttributes) if "Vector" in a or "Scalar" in a]
    
    # 3. Test a sample vector creation logic (Mental "Generate Vectors")
    try:
        # Create dummy data
        pts = vtk.vtkPoints()
        pts.InsertNextPoint(0,0,0)
        poly = vtk.vtkPolyData()
        poly.SetPoints(pts)
        
        # Create 6 component array (DX,DY,DZ,DRX,DRY,DRZ)
        arr = vtk.vtkFloatArray()
        arr.SetName("DEPL")
        arr.SetNumberOfComponents(6)
        arr.InsertNextTuple([1,2,3,4,5,6])
        poly.GetPointData().AddArray(arr)
        
        # Test: Setting active vectors on a multi-component array
        # Standard VTK might need 3 components only for GetActiveVectors
        poly.GetPointData().SetActiveVectors("DEPL")
        vecs = poly.GetPointData().GetVectors()
        
        results["active_vectors_on_6_comp"] = {
            "success": vecs is not None,
            "nb_comp": vecs.GetNumberOfComponents() if vecs else 0
        }
    except Exception as e:
        results["active_vectors_test_error"] = str(e)

    print("__JSON_START__")
    print(json.dumps(results, indent=2))
    print("__JSON_END__")

if __name__ == "__main__":
    discover()
