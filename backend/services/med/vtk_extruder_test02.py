import os
import json
import vtk
import numpy as np
import sys

# Parâmetros Padrão (Podem ser movidos para dentro da função se desejar)
SHELL_THICKNESS = 15.0
SHELL_OFFSET = 0.0
BEAM_OFFSET_Y = 0.0  
BEAM_OFFSET_Z = 0.0

COR_SOLIDO = (0.7, 0.2, 0.2)
COR_SHELL_FACE = (1.0, 1.0, 0.0)
COR_SHELL_VOL = (0.2, 0.6, 1.0)
COR_BEAM_VOL = (0.2, 0.8, 0.4)
COR_LINHA_MALHA = (0, 0, 0)

def load_json(path):
    if not os.path.exists(path): return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def apply_mesh_style(actor, color, show_edges=True):
    prop = actor.GetProperty()
    prop.SetColor(color)
    prop.SetRepresentationToSurface()
    prop.SetInterpolationToPhong()
    if show_edges:
        prop.SetEdgeVisibility(True)
        prop.SetEdgeColor(COR_LINHA_MALHA)
        prop.SetLineWidth(1.0)
    else:
        prop.SetEdgeVisibility(False)

def create_vtk_grid(data):
    pts = vtk.vtkPoints()
    p_list = data['points']
    for i in range(0, len(p_list), 3):
        pts.InsertNextPoint(p_list[i], p_list[i+1], p_list[i+2])
    grid = vtk.vtkUnstructuredGrid()
    grid.SetPoints(pts)
    for cell in data['connectivity']:
        grid.InsertNextCell(data['vtk_type'], len(cell), cell)
    return grid

def process_beam(beam_data, section_data, renderer):
    s_pts = vtk.vtkPoints()
    for i in range(0, len(section_data['points']), 3):
        s_pts.InsertNextPoint(section_data['points'][i], section_data['points'][i+1], section_data['points'][i+2])
    sect_poly = vtk.vtkPolyData()
    sect_poly.SetPoints(s_pts)
    cells = vtk.vtkCellArray()
    for tri in section_data['connectivity']:
        cells.InsertNextCell(len(tri), tri)
    sect_poly.SetPolys(cells)

    off_trans = vtk.vtkTransform()
    off_trans.Translate(0, BEAM_OFFSET_Y, BEAM_OFFSET_Z)
    off_filt = vtk.vtkTransformPolyDataFilter()
    off_filt.SetInputData(sect_poly)
    off_filt.SetTransform(off_trans)
    off_filt.Update()

    beam_pts = np.array(beam_data['points']).reshape(-1, 3)
    for seg in beam_data['connectivity']:
        p1, p2 = beam_pts[seg[0]], beam_pts[seg[1]]
        vec = p2 - p1
        length = np.linalg.norm(vec)
        if length < 1e-6: continue
        dir_v = vec / length
        trans = vtk.vtkTransform()
        trans.Translate(p1)
        v_ref = np.array([1.0, 0.0, 0.0])
        axis = np.cross(v_ref, dir_v)
        angle = np.degrees(np.arccos(np.clip(np.dot(v_ref, dir_v), -1.0, 1.0)))
        if np.linalg.norm(axis) > 1e-6: trans.RotateWXYZ(angle, axis)
        elif np.dot(v_ref, dir_v) < 0: trans.RotateWXYZ(180, [0, 1, 0])

        t_filt = vtk.vtkTransformPolyDataFilter()
        t_filt.SetInputData(off_filt.GetOutput())
        t_filt.SetTransform(trans)
        
        extruder = vtk.vtkLinearExtrusionFilter()
        extruder.SetInputConnection(t_filt.GetOutputPort())
        extruder.SetExtrusionTypeToVectorExtrusion()
        extruder.SetVector(dir_v)
        extruder.SetScaleFactor(length)
        extruder.Update()

        actor = vtk.vtkActor()
        mapper = vtk.vtkPolyDataMapper()
        mapper.SetInputConnection(extruder.GetOutputPort())
        actor.SetMapper(mapper)
        apply_mesh_style(actor, COR_BEAM_VOL, show_edges=False)
        renderer.AddActor(actor)

def run_visualization(dir_alvo):
    """Função principal que será chamada externamente"""
    if not os.path.exists(dir_alvo):
        print(f"[ERRO] Pasta não encontrada: {dir_alvo}")
        return

    renderer = vtk.vtkRenderer()
    renderWin = vtk.vtkRenderWindow()
    renderWin.AddRenderer(renderer)
    
    # 1. Vigas
    beam_j = load_json(os.path.join(dir_alvo, "beam.json"))
    sect_j = load_json(os.path.join(dir_alvo, "section_mesh.json"))
    if beam_j and sect_j:
        process_beam(beam_j, sect_j, renderer)

    # 2. Outros
    files = [f for f in os.listdir(dir_alvo) if f.endswith('.json') and f not in ['beam.json', 'section_mesh.json', 'project.json']]
    
    for f in files:
        data = load_json(os.path.join(dir_alvo, f))
        v_type = data.get('vtk_type')

        if v_type in [5, 9]: # Cascas
            grid = create_vtk_grid(data)
            geom = vtk.vtkGeometryFilter()
            geom.SetInputData(grid)
            act_f = vtk.vtkActor()
            map_f = vtk.vtkDataSetMapper()
            map_f.SetInputData(grid)
            act_f.SetMapper(map_f)
            apply_mesh_style(act_f, COR_SHELL_FACE, show_edges=True)
            map_f.SetRelativeCoincidentTopologyPolygonOffsetParameters(-1, -1)
            renderer.AddActor(act_f)

            norm = vtk.vtkPolyDataNormals()
            norm.SetInputConnection(geom.GetOutputPort())
            warp = vtk.vtkWarpVector()
            warp.SetInputConnection(norm.GetOutputPort())
            warp.SetInputArrayToProcess(0, 0, 0, 0, vtk.vtkDataSetAttributes.NORMALS)
            warp.SetScaleFactor(SHELL_OFFSET - (SHELL_THICKNESS / 2.0))
            ext = vtk.vtkLinearExtrusionFilter()
            ext.SetInputConnection(warp.GetOutputPort())
            ext.SetExtrusionTypeToNormalExtrusion()
            ext.SetScaleFactor(SHELL_THICKNESS)
            act_v = vtk.vtkActor()
            map_v = vtk.vtkPolyDataMapper()
            map_v.SetInputConnection(ext.GetOutputPort())
            act_v.SetMapper(map_v)
            apply_mesh_style(act_v, COR_SHELL_VOL, show_edges=False)
            renderer.AddActor(act_v)

        elif v_type in [10, 11, 12, 13, 14]: # Sólidos
            grid = create_vtk_grid(data)
            mapper = vtk.vtkDataSetMapper()
            mapper.SetInputData(grid)
            actor = vtk.vtkActor()
            actor.SetMapper(mapper)
            apply_mesh_style(actor, COR_SOLIDO, show_edges=True)
            renderer.AddActor(actor)

    renderer.SetBackground(0.1, 0.1, 0.1)
    renderWin.SetSize(1280, 720)
    interactor = vtk.vtkRenderWindowInteractor()
    interactor.SetRenderWindow(renderWin)
    renderWin.Render()
    renderer.ResetCamera()
    interactor.Start()

if __name__ == "__main__":
    # Permite rodar diretamente: python visualizador.py "C:/caminho/da/pasta"
    path_arg = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\jorge\OneDrive\ProSolveSimulation\testcases\hibrido"
    run_visualization(path_arg)