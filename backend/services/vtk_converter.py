import os
import subprocess
import json
import vtk
import meshio
import numpy as np

def vtk_obj_to_json(vtk_obj):
    """Auxiliary to convert VTK result back to frontend JSON format"""
    points = []
    pts = vtk_obj.GetPoints()
    if not pts: return {"points": [], "connectivity": []}
    for i in range(pts.GetNumberOfPoints()):
        points.append(pts.GetPoint(i))
    cells = []
    for i in range(vtk_obj.GetNumberOfCells()):
        cell = vtk_obj.GetCell(i)
        p_ids = [cell.GetPointId(j) for j in range(cell.GetNumberOfPoints())]
        cells.append(p_ids)
    return {"points": points, "connectivity": cells}

def call_med_extractor(file_path):
    """
    STRICT STEP 1: Calls med_extractor.py to get groups and mesh info.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    med_dir = os.path.join(base_dir, "MEDCOUPLING-9.15.0", "MEDCOUPLING-9.15.0")
    extractor_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "med", "med_extractor.py")

    if not os.path.exists(med_dir):
        print(f"[VTK] MEDCOUPLING directory not found at {med_dir}")
        return None
        
    try:
        cmd = f'cmd /c "cd /d {med_dir} && call env_launch.bat && python \"{extractor_path}\" \"{file_path}\""'
        print(f"[VTK] Extracting Groups via med_extractor.py...")
        
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
        if result.returncode == 0:
            output = result.stdout.strip()
            lines = output.split('\n')
            for line in reversed(lines):
                line = line.strip()
                if line.startswith('{') and line.endswith('}'):
                    try:
                        data = json.loads(line)
                        if data.get("status") == "success": return data
                    except: continue
        else:
            print(f"[VTK] med_extractor failed: {result.stderr}")
    except Exception as e:
        print(f"[VTK] Error calling extractor: {e}")
    return None

def med_to_vtk_json(file_path, geometries=None):
    """
    Convert MED file to VTK JSON with NATIVE EXTRUSION.
    Follows: Load -> med_extractor -> VTK filters.
    """
    try:
        if not os.path.exists(file_path):
            return {"status": "error", "message": f"File not found: {file_path}"}

        # 1. GET SOURCE DATA (Strict Step 1)
        med_data = call_med_extractor(file_path)
        if not med_data:
            return {"status": "error", "message": "Failed to extract MED data"}

        points = med_data["points"]
        cells_by_group_source = med_data["cells"]
        
        geom_map = {}
        if geometries:
            for g in geometries:
                group = g.get('group')
                if group: geom_map[str(group).strip().upper()] = g

        final_points = list(points)
        final_cells = {}

        # 2. PROCESS NATIVE VTK EXTRUSION (Keep as requested)
        for g_name, g_data in cells_by_group_source.items():
            connectivity = g_data["connectivity"]
            cell_type = g_data["type"]
            
            geom = geom_map.get(str(g_name).strip().upper())
            category = geom.get('_category') if geom else None
            if not category:
                category = '1D' if cell_type == 'line' else ('2D' if cell_type in ('triangle', 'quad') else '3D')

            params = geom.get('section_params', {}) if geom else {}
            thickness = float(params.get('thickness', 0.0))
            offset = float(params.get('offset', 0.0))

            if category == '2D' and thickness > 0:
                print(f"[VTK] NATIVE: Extruding Shell {g_name}")
                vtk_pts = vtk.vtkPoints()
                for p in points: vtk_pts.InsertNextPoint(p)
                
                poly = vtk.vtkPolyData()
                poly.SetPoints(vtk_pts)
                polys = vtk.vtkCellArray()
                for c in connectivity:
                    polys.InsertNextCell(len(c))
                    for p_idx in c: polys.InsertCellPoint(p_idx)
                poly.SetPolys(polys)
                
                norm = vtk.vtkPolyDataNormals()
                norm.SetInputData(poly)
                norm.SetComputePointNormals(True)
                norm.SplittingOff()
                norm.Update()
                
                warp = vtk.vtkWarpVector()
                warp.SetInputConnection(norm.GetOutputPort())
                warp.SetScaleFactor(offset - thickness/2.0)
                warp.Update()
                
                ext = vtk.vtkLinearExtrusionFilter()
                ext.SetInputConnection(warp.GetOutputPort())
                ext.SetExtrusionTypeToNormalExtrusion()
                ext.SetScaleFactor(thickness)
                ext.Update()
                
                res = vtk_obj_to_json(ext.GetOutput())
                base_idx = len(final_points)
                final_points.extend(res["points"])
                translated_conn = [[i + base_idx for i in c] for c in res["connectivity"]]
                
                final_cells[g_name] = {"type": "quad", "connectivity": translated_conn, "is_extruded": True}
                final_cells[g_name + "_ORIGINAL"] = {"type": cell_type, "connectivity": connectivity, "is_extruded": False}

            elif category == '1D' and cell_type == 'line':
                print(f"[VTK] NATIVE: Extruding Beam {g_name}")
                radius = float(params.get('radius', 0.05))
                vtk_pts = vtk.vtkPoints()
                for p in points: vtk_pts.InsertNextPoint(p)
                
                poly = vtk.vtkPolyData()
                poly.SetPoints(vtk_pts)
                lines = vtk.vtkCellArray()
                for c in connectivity:
                    lines.InsertNextCell(len(c))
                    for p_idx in c: lines.InsertCellPoint(p_idx)
                poly.SetLines(lines)
                
                tuber = vtk.vtkTubeFilter()
                tuber.SetInputData(poly)
                tuber.SetRadius(radius)
                tuber.SetNumberOfSides(8)
                tuber.CappingOn()
                tuber.Update()
                
                res = vtk_obj_to_json(tuber.GetOutput())
                base_idx = len(final_points)
                final_points.extend(res["points"])
                translated_conn = [[i + base_idx for i in c] for c in res["connectivity"]]
                
                final_cells[g_name] = {"type": "quad", "connectivity": translated_conn, "is_extruded": True}
                final_cells[g_name + "_ORIGINAL"] = {"type": cell_type, "connectivity": connectivity, "is_extruded": False}
            else:
                final_cells[g_name] = g_data # Keep original metadata

        return {
            "status": "success",
            "points": final_points,
            "cells": final_cells,
            "num_points": len(final_points),
            "num_groups": len(final_cells)
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": f"VTK Process Error: {str(e)}"}
