#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import os
import json
import vtk

# ==========================================================
# PARÂMETROS DE CONFIGURAÇÃO
# ==========================================================
# Se passar um diretório por argumento no terminal, ele usa. 
# Caso contrário, usa o caminho abaixo:
DIRETORIO_ALVO = r"C:\Users\jorge\OneDrive\ProSolveSimulation\testcases\hibrido"

ESPESSURA = 10.0  # Para as cascas
OFFSET    = -5   # Centralizado
# ==========================================================

def process_mesh(json_path, renderer):
    """Lê o JSON e decide se extruda ou apenas renderiza."""
    if not os.path.exists(json_path): return

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    points_data = data.get("points", [])
    connectivity = data.get("connectivity", [])
    vtk_type = data.get("vtk_type", 5)
    name = os.path.basename(json_path)

    # 1. Criar Pontos e Grid
    vtk_pts = vtk.vtkPoints()
    for i in range(0, len(points_data), 3):
        vtk_pts.InsertNextPoint(points_data[i], points_data[i+1], points_data[i+2])

    grid = vtk.vtkUnstructuredGrid()
    grid.SetPoints(vtk_pts)
    for cell in connectivity:
        grid.InsertNextCell(vtk_type, len(cell), cell)

    # 2. DECISÃO DE RENDERIZAÇÃO
    # Cascas (TRI3=5, QUAD4=9) -> EXTRUDA
    if vtk_type in [5, 9]:
        print(f"[SHELL] Extrudando: {name}")
        
        # Actor da Face Original (Amarelo)
        m_mapper = vtk.vtkDataSetMapper()
        m_mapper.SetInputData(grid)
        m_actor = vtk.vtkActor()
        m_actor.SetMapper(m_mapper)
        m_actor.GetProperty().SetColor(1, 1, 0) # Amarelo
        m_actor.GetProperty().SetEdgeVisibility(True)
        m_actor.GetProperty().SetEdgeColor(0,0,0)
        m_mapper.SetRelativeCoincidentTopologyPolygonOffsetParameters(-1, -1)
        renderer.AddActor(m_actor)

        # Pipeline de Extrusão com Offset
        geom = vtk.vtkGeometryFilter()
        geom.SetInputData(grid)
        
        normals = vtk.vtkPolyDataNormals()
        normals.SetInputConnection(geom.GetOutputPort())
        normals.ComputePointNormalsOn()
        
        start_pos = OFFSET - (ESPESSURA / 2.0)
        warp = vtk.vtkWarpVector()
        warp.SetInputConnection(normals.GetOutputPort())
        warp.SetInputArrayToProcess(0, 0, 0, vtk.vtkDataObject.FIELD_ASSOCIATION_POINTS, vtk.vtkDataSetAttributes.NORMALS)
        warp.SetScaleFactor(start_pos)
        
        extruder = vtk.vtkLinearExtrusionFilter()
        extruder.SetInputConnection(warp.GetOutputPort())
        extruder.SetExtrusionTypeToNormalExtrusion()
        extruder.SetScaleFactor(ESPESSURA)
        
        ext_mapper = vtk.vtkPolyDataMapper()
        ext_mapper.SetInputConnection(extruder.GetOutputPort())
        ext_actor = vtk.vtkActor()
        ext_actor.SetMapper(ext_mapper)
        ext_actor.GetProperty().SetColor(0.2, 0.6, 1.0) # Azul
        ext_actor.GetProperty().SetOpacity(1.0)
        renderer.AddActor(ext_actor)

    # Linhas (SEG2=3) -> APENAS LINHAS
    elif vtk_type in [3, 4]:
        print(f"[LINE] Renderizando linhas: {name}")
        l_mapper = vtk.vtkDataSetMapper()
        l_mapper.SetInputData(grid)
        l_actor = vtk.vtkActor()
        l_actor.SetMapper(l_mapper)
        l_actor.GetProperty().SetColor(0, 1, 0) # Verde
        l_actor.GetProperty().SetLineWidth(2)
        renderer.AddActor(l_actor)

    # Sólidos (TETRA=10, HEXA=12) -> APENAS O VOLUME ORIGINAL
    else:
        print(f"[SOLID] Renderizando volume original: {name}")
        s_mapper = vtk.vtkDataSetMapper()
        s_mapper.SetInputData(grid)
        s_actor = vtk.vtkActor()
        s_actor.SetMapper(s_mapper)
        s_actor.GetProperty().SetColor(0.7, 0.2, 0.2) # Vermelho escuro
        s_actor.GetProperty().SetOpacity(0.5)
        s_actor.GetProperty().SetEdgeVisibility(True)
        renderer.AddActor(s_actor)

def run_scene_viewer(folder_path):
    if not os.path.isdir(folder_path):
        print(f"Erro: Pasta não encontrada: {folder_path}")
        return

    json_files = [f for f in os.listdir(folder_path) if f.lower().endswith('.json') and f != 'project.json']
    
    if not json_files:
        print("Nenhum arquivo de malha JSON encontrado.")
        return

    # Setup do VTK
    renderer = vtk.vtkRenderer()
    renderWin = vtk.vtkRenderWindow()
    renderWin.AddRenderer(renderer)
    renderWin.SetWindowName(f"VTK Multi-Mesh Viewer - {os.path.basename(folder_path)}")
    renderWin.SetSize(1280, 720)

    interactor = vtk.vtkRenderWindowInteractor()
    interactor.SetRenderWindow(renderWin)

    print(f"\n--- Carregando arquivos de: {folder_path} ---")
    for jf in json_files:
        full_path = os.path.join(folder_path, jf)
        process_mesh(full_path, renderer)

    renderer.SetBackground(0.1, 0.1, 0.1)
    renderWin.Render()
    renderer.ResetCamera()
    renderWin.Render()
    
    print("\n[INFO] 'q' para sair | Mouse para rotacionar.")
    interactor.Start()

if __name__ == "__main__":
    path = DIRETORIO_ALVO
    if len(sys.argv) > 1:
        path = sys.argv[1]
    
    run_scene_viewer(path)