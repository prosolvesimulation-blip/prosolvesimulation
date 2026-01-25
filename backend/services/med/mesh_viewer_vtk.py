#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MeshViewer VTK Standalone
Renders structured JSON mesh data (points + element connectivity) using native VTK.
Usage: python mesh_viewer_vtk.py <path_to_json>
"""
import sys
import os
import json
import vtk
import subprocess

def get_mesh_data(file_path):
    """Loads mesh data from JSON or triggers generation from MED."""
    if file_path.lower().endswith('.json'):
        if not os.path.exists(file_path): return None
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    if file_path.lower().endswith('.med'):
        json_path = file_path.replace('.med', '.json')
        print(f"[PROCESS] Calling MED extractor for: {os.path.basename(file_path)}...")
        
        # Paths for environment setup
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        med_env_dir = os.path.join(project_root, "MEDCOUPLING-9.15.0", "MEDCOUPLING-9.15.0")
        mesher_script = os.path.join(project_root, "backend", "services", "med", "med_mesher.py")
        
        # Command to generate JSON on disk
        cmd = f'cmd /c "cd /d {med_env_dir} && call env_launch.bat && python {mesher_script} {file_path}"'
        
        try:
            subprocess.run(cmd, check=True, shell=True, capture_output=True)
            if os.path.exists(json_path):
                with open(json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                print(f"[SUCCESS] JSON generated and loaded: {os.path.basename(json_path)}")
                return data
            else:
                print(f"[ERROR] Generator finished but JSON not found: {json_path}")
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] MED Generator failed: {e.stderr}")
            
    return None

def render_meshes(json_paths):
    # Setup Renderer and Window
    renderer = vtk.vtkRenderer()
    renderWin = vtk.vtkRenderWindow()
    renderWin.AddRenderer(renderer)
    renderWin.SetSize(1280, 720)
    
    interactor = vtk.vtkRenderWindowInteractor()
    interactor.SetRenderWindow(renderWin)
    
    # 🎨 Color Cycle for differentiation
    colors = [
        [0.2, 0.6, 1.0], # Sky Blue
        [1.0, 0.5, 0.0], # Orange
        [0.0, 1.0, 0.5], # Spring Green
        [1.0, 0.2, 0.2], # Red
        [0.8, 0.8, 0.1], # Yellow
    ]

    print("\n[VIEWER] Loading Assembly...")
    
    for idx, json_path in enumerate(json_paths):
        data = get_mesh_data(json_path)
        if not data:
            print(f"[REJECTED] Could not load or generate: {json_path}")
            continue

        points_data = data.get("points", [])
        connectivity = data.get("connectivity", [])
        vtk_type = data.get("vtk_type")

        # 1. POINTS
        vtk_pts = vtk.vtkPoints()
        for i in range(0, len(points_data), 3):
            vtk_pts.InsertNextPoint(points_data[i], points_data[i+1], points_data[i+2])

        # 2. GRID
        grid = vtk.vtkUnstructuredGrid()
        grid.SetPoints(vtk_pts)
        
        for cell in connectivity:
            current_type = vtk_type
            if current_type is None:
                if len(cell) == 2: current_type = vtk.VTK_LINE
                elif len(cell) == 4: current_type = vtk.VTK_QUAD
                elif len(cell) == 8: current_type = vtk.VTK_HEXAHEDRON
                else: current_type = vtk.VTK_POLYGON
            grid.InsertNextCell(current_type, len(cell), cell)

        # 3. ACTORS
        mapper = vtk.vtkDataSetMapper()
        mapper.SetInputData(grid)

        actor = vtk.vtkActor()
        actor.SetMapper(mapper)
        
        # Apply color from cycle
        mesh_color = colors[idx % len(colors)]
        actor.GetProperty().SetColor(*mesh_color)
        actor.GetProperty().SetEdgeVisibility(True)
        actor.GetProperty().SetPointSize(4)
        
        # 4. OUTLINE per mesh
        outline = vtk.vtkOutlineFilter()
        outline.SetInputData(grid)
        outlineMapper = vtk.vtkPolyDataMapper()
        outlineMapper.SetInputConnection(outline.GetOutputPort())
        outlineActor = vtk.vtkActor()
        outlineActor.SetMapper(outlineMapper)
        outlineActor.GetProperty().SetColor(1, 1, 1) # White

        renderer.AddActor(actor)
        renderer.AddActor(outlineActor)
        
        print(f"[LOADED] {os.path.basename(json_path)}: {vtk_pts.GetNumberOfPoints()} pts, {grid.GetNumberOfCells()} cells")

    # Start interaction
    renderer.SetBackground(0.1, 0.1, 0.1)
    renderWin.SetWindowName(f"ProSolve Multi-Mesh Viewer ({len(json_paths)} components)")
    
    renderWin.Render()
    renderer.ResetCamera()
    renderWin.Render()
    
    print("[INFO] Assembly view ready. 'q' to exit.")
    interactor.Start()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python mesh_viewer_vtk.py <mesh1.json> [mesh2.json ...]")
    else:
        render_meshes(sys.argv[1:])
