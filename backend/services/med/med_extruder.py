import sys
import os
import json

# Modular MED Extruder
# Purpose: High-performance shell extrusion and boundary extraction.
# Runs in MEDCOUPLING 9.15.0 environment (Python 3.9)

try:
    import MEDLoader as ml
    import medcoupling as mc
    import numpy as np
except ImportError as e:
    print(json.dumps({"status": "error", "message": f"MEDCOUPLING modules not found: {e}"}))
    sys.exit(1)

def get_aster_cell_type(mc_type):
    mapping = {
        mc.NORM_SEG2: "SEG2", mc.NORM_SEG3: "SEG3",
        mc.NORM_TRI3: "TRI3", mc.NORM_TRI6: "TRI6",
        mc.NORM_QUAD4: "QUAD4", mc.NORM_QUAD8: "QUAD8",
        mc.NORM_TETRA4: "TETRA4", mc.NORM_TETRA10: "TETRA10",
        mc.NORM_HEXA8: "HEXA8", mc.NORM_HEXA20: "HEXA20",
        mc.NORM_PENTA6: "PENTA6", mc.NORM_PENTA15: "PENTA15",
        mc.NORM_PYRA5: "PYRA5", mc.NORM_PYRA13: "PYRA13",
        mc.NORM_POINT1: "POIN1"
    }
    return mapping.get(mc_type, f"TYPE_{mc_type}")

def perform_extrusion(file_path, geometries=None):
    if not os.path.exists(file_path):
        return {"status": "error", "message": f"File not found: {file_path}"}
        
    geom_map = {}
    if geometries:
        for g in geometries:
            group = g.get('group')
            if group:
                geom_map[group.strip().upper()] = g
                
    try:
        mesh_names = ml.GetMeshNames(file_path)
        if not mesh_names:
            return {"status": "error", "message": "No meshes found in file"}
            
        mesh_name = mesh_names[0]
        mfile = ml.MEDFileUMesh.New(file_path, mesh_name)
        all_groups = mfile.getGroupsNames()
        
        # We will collect sub-meshes for a SINGLE MergeUMeshes call at the end
        submeshes_to_merge = []
        group_meta = [] # List of (final_name, is_extruded)
        
        for g_name in all_groups:
            # 1. ATTEMPT CELL GROUP
            try:
                g_arr = mfile.getGroupArr(0, g_name)
                if g_arr.getNumberOfTuples() > 0:
                    # Read this group sub-mesh
                    group_mesh = ml.ReadUMeshFromGroups(file_path, mesh_name, 0, [g_name])
                    if group_mesh.getSpaceDimension() == 2:
                        group_mesh.changeSpaceDimension(3)
                    
                    # SYSTEMATIC CHECK: Should we extrude this group?
                    geom = geom_map.get(g_name.strip().upper())
                    is_shell = False
                    thickness = 0.0
                    offset_val = 0.0
                    
                    if geom:
                        params = geom.get('section_params', {})
                        thickness = float(params.get('thickness', 0.0))
                        offset_val = float(params.get('offset', 0.0))
                        model_type = str(geom.get('type', '')).upper()
                        is_shell = model_type in ('DKT', 'DST', 'COQUE_3D', 'MEMBRANE') or \
                                   'SHELL' in model_type or 'QUAD' in model_type or 'TRIA' in model_type
                    
                    if is_shell and thickness > 0:
                        # --- THE 2-COMMAND SYSTEMATIC ---
                        
                        # Command A: Create 1D Path Mesh for extrusion
                        z_start = offset_val - thickness/2.0
                        z_end = offset_val + thickness/2.0
                        path_coords = mc.DataArrayDouble([0,0,z_start, 0,0,z_end], 2, 3)
                        path_mesh = mc.MEDCouplingUMesh("Path", 1)
                        path_mesh.setCoords(path_coords)
                        path_mesh.allocateCells(1)
                        path_mesh.insertNextCell(mc.NORM_SEG2, [0, 1])
                        
                        # Command 1: EXTRUDE (Generates volumes/quals depending on input)
                        vol_mesh = group_mesh.buildExtrudedMesh(path_mesh, 0)
                        
                        # Command 2: SKIN (Extracts boundary surfaces only)
                        skin_mesh = vol_mesh.buildBoundaryMesh(False) # False = independent mesh
                        
                        # Add Original to merge list
                        submeshes_to_merge.append(group_mesh)
                        group_meta.append((g_name, False))
                        
                        # Add Extruded Skin to merge list
                        submeshes_to_merge.append(skin_mesh)
                        group_meta.append((g_name + "_EXTRUDED", True))
                    else:
                        # Regular group without extrusion
                        submeshes_to_merge.append(group_mesh)
                        group_meta.append((g_name, False))
                    continue # Succeeded with cell group
            except: pass
            
            # 2. ATTEMPT NODE GROUP
            try:
                node_arr = mfile.getNodeGroupArr(g_name)
                if node_arr.getNumberOfTuples() > 0:
                    # We don't merge node groups into the UMesh, but we track them for counts
                    # Actually MergeUMeshes only works for meshes with cells.
                    # We'll handle node groups as special metadata
                    pass
            except: pass

        # NATIVE AGGREGATION: Single call to MergeUMeshes
        if not submeshes_to_merge:
            return {"status": "error", "message": "No meshes to merge"}
            
        merged_mesh = mc.MEDCouplingUMesh.MergeUMeshes(submeshes_to_merge)
        
        all_points = merged_mesh.getCoords().toNumPyArray().tolist()
        merged_con = merged_mesh.getNodalConnectivity().toNumPyArray().flatten()
        merged_idx = merged_mesh.getNodalConnectivityIndex().toNumPyArray().flatten()
        
        cells_output = {}
        cell_ptr = 0
        
        for i, (final_name, is_ext) in enumerate(group_meta):
            mesh = submeshes_to_merge[i]
            n_c = mesh.getNumberOfCells()
            connectivity = []
            
            # Identify VTK type
            mc_type = mesh.getTypeOfCell(0)
            vtk_type = "unknown"
            if mc_type == mc.NORM_SEG2: vtk_type = "line"
            elif mc_type == mc.NORM_TRI3: vtk_type = "triangle"
            elif mc_type == mc.NORM_QUAD4: vtk_type = "quad"
            
            for _ in range(n_c):
                start, end = int(merged_idx[cell_ptr]), int(merged_idx[cell_ptr+1])
                connectivity.append(merged_con[start:end].tolist())
                cell_ptr += 1
                
            cells_output[final_name] = {
                "type": vtk_type,
                "connectivity": connectivity,
                "count": n_c,
                "is_extruded": is_ext
            }
            
        return {
            "status": "success",
            "points": all_points,
            "cells": cells_output,
            "num_points": len(all_points),
            "num_groups": len(cells_output)
        }
    except Exception as e:
        import traceback
        return {"status": "error", "message": str(e), "traceback": traceback.format_exc()}

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(1)
    geos = None
    if len(sys.argv) > 2:
        try:
            with open(sys.argv[2], 'r') as f:
                d = json.load(f)
                geos = d if isinstance(d, list) else d.get("geometries")
        except: pass
    print(json.dumps(perform_extrusion(sys.argv[1], geos)))
