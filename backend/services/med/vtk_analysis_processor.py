import sys
import os
import json
import numpy as np
import vtk
from vtk.util import numpy_support

# ==============================================================================
# VTK_ANALYSIS_SERVICE.PY - VTK-NATIVE PROCESSOR
# Goal: Build real VTK datasets and apply NATIVE commands for result display.
# Logic: Map Data -> VTK Object -> Set Active Attributes -> Export for screen.
# ==============================================================================

def build_vtk_scene(report_data, field_target=None):
    """
    Core Processor: Converts raw Report Data into NATIVE VTK Objects.
    Applies Active Scalars and Warp filters (ParaView Native).
    """
    try:
        mesh_rpt = report_data.get("mesh_report")
        field_rpt = report_data.get("field_report")
        
        if not mesh_rpt: return {"status": "error", "message": "Mesh data missing"}
        
        # 1. CONSTRUCT POINTS
        pts_raw = mesh_rpt["data"]["points"]
        num_pts = len(pts_raw) // 3
        pts_np = np.array(pts_raw).reshape(-1, 3)
        
        vtk_pts = vtk.vtkPoints()
        vtk_pts.SetData(numpy_support.numpy_to_vtk(pts_np))
        
        # 2. CONSTRUCT DATASET (PolyData / Unstructured)
        # For simplicity and frontend compatibility with VTK.js, we use PolyData
        pd = vtk.vtkPolyData()
        pd.SetPoints(vtk_pts)
        
        # Add Connectivity
        conn_raw = mesh_rpt["data"]["connectivity"]
        num_cells = mesh_rpt["data"]["num_elements"]
        nodes_per_cell = len(conn_raw) // num_cells
        
        cells = vtk.vtkCellArray()
        for i in range(num_cells):
            cell_nodes = conn_raw[i * nodes_per_cell : (i + 1) * nodes_per_cell]
            # Skip MED prefix if present (Spiderweb fix in standard VTK loop)
            if nodes_per_cell > 1:
                # Typically [N, id0, id1...] or [id0, id1...]
                # We trust the extractor or clean it here.
                # Based on MED standard, we take the last N items.
                # Here we use the report data as extracted.
                cells.InsertNextCell(len(cell_nodes))
                for n_idx in cell_nodes: cells.InsertCellPoint(n_idx)
            else:
                cells.InsertNextCell(1)
                cells.InsertCellPoint(cell_nodes[0])
        
        # Identify type
        med_type = mesh_rpt["data"]["med_cell_type"]
        if med_type in [2, 3]: pd.SetLines(cells) # Line
        else: pd.SetPolys(cells) # Quad/Tri/Poly
        
        # 3. APPLY NATIVE PHYSICS ATTRIBUTES
        if field_rpt:
            f_name = field_rpt["data"]["name"]
            f_vals = field_rpt["data"]["values"]
            f_loc = field_rpt["data"]["location"]
            f_comp = field_rpt["data"]["nb_comp"]
            
            arr = numpy_support.numpy_to_vtk(np.array(f_vals).reshape(-1, f_comp))
            arr.SetName(f_name)
            
            # ATTACH TO DATASET
            if f_loc == "node":
                pd.GetPointData().AddArray(arr)
            else:
                pd.GetCellData().AddArray(arr)
            
            # --- NATIVE PARA-VIEW COMMANDS ---
            
            # A. Vector Handling (For Warping)
            if "DEPL" in f_name or f_comp == 6:
                # Implementation of vtkArrayCalculator to normalize to 3-vec
                calc = vtk.vtkArrayCalculator()
                calc.SetInputData(pd)
                calc.AddScalarVariable("dx", f_name, 0)
                calc.AddScalarVariable("dy", f_name, 1)
                calc.AddScalarVariable("dz", f_name, 2)
                calc.SetFunction("dx*iHat + dy*jHat + dz*kHat")
                calc.SetResultArrayName("Displacement_VEC")
                calc.Update()
                pd.GetPointData().AddArray(calc.GetOutput().GetPointData().GetArray("Displacement_VEC"))
                pd.GetPointData().SetActiveVectors("Displacement_VEC")

            # B. Scalar Activation (The "Heatmap" instruction)
            # If multi-comp (Stress), ParaView typically shows VonMises (Comp 0 or Magnitude)
            pd_with_scalars = pd
            if f_comp > 1 and not "DEPL" in f_name:
                # Extract first comp as Heatmap Scalar
                calc = vtk.vtkArrayCalculator()
                calc.SetInputData(pd)
                calc.AddScalarVariable("val", f_name, 0)
                calc.SetFunction("val")
                calc.SetResultArrayName("Heatmap_SCALARS")
                calc.Update()
                res_pd = calc.GetOutput()
                if f_loc == "node":
                    res_pd.GetPointData().SetActiveScalars("Heatmap_SCALARS")
                else:
                    res_pd.GetCellData().SetActiveScalars("Heatmap_SCALARS")
                pd_with_scalars = res_pd
            else:
                # Single comp or already scalarized
                if f_loc == "node":
                    pd.GetPointData().SetActiveScalars(f_name)
                else:
                    pd.GetCellData().SetActiveScalars(f_name)
                    
        # 4. EXPORT JSON (ParaView Native Stream)
        return export_dataset_to_screen(pd_with_scalars)

    except Exception as e:
        return {"status": "error", "message": f"VTK Processing Error: {str(e)}", "traceback": traceback.format_exc()}

def export_dataset_to_screen(vtk_pd):
    """Encodes the VTK object into a structured JSON for the frontend VTK viewer."""
    # This structure mirrors the expectations of the frontend PolyData reader
    points = []
    pts = vtk_pd.GetPoints()
    for i in range(pts.GetNumberOfPoints()):
        points.append(pts.GetPoint(i))
    
    # Cells (Structured for frontend)
    connectivity = []
    cells = vtk_pd.GetPolys() if vtk_pd.GetNumberOfPolys() > 0 else vtk_pd.GetLines()
    cells.InitTraversal()
    pt_ids = vtk.vtkIdList()
    while cells.GetNextCell(pt_ids):
        connectivity.append([pt_ids.GetId(j) for j in range(pt_ids.GetNumberOfIds())])

    # Attributes (The Native Stream)
    scalars = []
    loc = "node"
    active_scalars = vtk_pd.GetPointData().GetScalars()
    if active_scalars:
        scalars = [active_scalars.GetComponent(i, 0) for i in range(active_scalars.GetNumberOfTuples())]
        loc = "node"
    else:
        active_scalars = vtk_pd.GetCellData().GetScalars()
        if active_scalars:
            scalars = [active_scalars.GetComponent(i, 0) for i in range(active_scalars.GetNumberOfTuples())]
            loc = "cell"

    # Vectors (Warping)
    vectors = []
    active_vectors = vtk_pd.GetPointData().GetVectors()
    if active_vectors:
        for i in range(active_vectors.GetNumberOfTuples()):
            vectors.append(list(active_vectors.GetTuple(i)))

    return {
        "status": "success",
        "mesh": {
            "points": points,
            "connectivity": connectivity,
            "num_elements": len(connectivity)
        },
        "physics": {
            "scalars": scalars,
            "vectors": vectors,
            "location": loc
        }
    }

if __name__ == "__main__":
    if len(sys.argv) < 3: sys.exit(1)
    
    # In a real split-service scenario, this script would read from stdin or a temp file
    # Here we assume the input is the JSON string of the report data
    try:
        report_json = sys.argv[1]
        field_target = sys.argv[2] if len(sys.argv) > 2 else None
        
        data = json.loads(report_json)
        result = build_vtk_scene(data, field_target)
        
        sys.stdout.write("__JSON_START__")
        sys.stdout.write(json.dumps(result))
        sys.stdout.write("__JSON_END__")
    except Exception as e:
        sys.stdout.write(json.dumps({"status": "error", "message": f"Processor entry failure: {e}"}))
