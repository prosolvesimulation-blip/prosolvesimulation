import os
import json
import vtk
import numpy as np
from vtk.util import numpy_support
import sys

# ==========================================================
# PARÂMETROS FÍSICOS
# ==========================================================
SHELL_THICKNESS = 15.0
SHELL_OFFSET = 0.0
BEAM_OFFSET_Y = 0.0  
BEAM_OFFSET_Z = 0.0

def load_json(path):
    if not os.path.exists(path): return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(data, path):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f)
    print(f"   [GERADO] {os.path.basename(path)}")

def vtk_dataset_to_dict(vtk_data):
    """
    Converte um objeto VTK processado (PolyData) de volta para o formato JSON.
    """
    # 1. Extrair Pontos
    points_array = vtk_data.GetPoints().GetData()
    numpy_points = numpy_support.vtk_to_numpy(points_array)
    # Flatten para lista [x1, y1, z1, x2, y2, z2...]
    points_list = numpy_points.flatten().tolist()

    # 2. Extrair Conectividade
    connectivity_list = []
    num_cells = vtk_data.GetNumberOfCells()
    
    # Tipo da primeira célula (referência)
    first_cell_type = vtk_data.GetCellType(0) if num_cells > 0 else 0

    for i in range(num_cells):
        cell = vtk_data.GetCell(i)
        pid = cell.GetPointIds()
        ids = [pid.GetId(j) for j in range(pid.GetNumberOfIds())]
        connectivity_list.append(ids)

    return {
        "vtk_type": first_cell_type,
        "count": num_cells,
        "points": points_list,
        "connectivity": connectivity_list
    }

def process_beam_headless(beam_data, section_data, output_path):
    """
    Gera a geometria 3D das vigas (Tubos/Perfis) e salva em JSON.
    Replica a lógica 'process_beam' do visualizador.
    """
    # 1. Prepara a Seção Transversal
    s_pts = vtk.vtkPoints()
    for i in range(0, len(section_data['points']), 3):
        s_pts.InsertNextPoint(section_data['points'][i], section_data['points'][i+1], section_data['points'][i+2])
    
    sect_poly = vtk.vtkPolyData()
    sect_poly.SetPoints(s_pts)
    cells = vtk.vtkCellArray()
    for tri in section_data['connectivity']:
        cells.InsertNextCell(len(tri), tri)
    sect_poly.SetPolys(cells)

    # Offset Local
    off_trans = vtk.vtkTransform()
    off_trans.Translate(0, BEAM_OFFSET_Y, BEAM_OFFSET_Z)
    off_filt = vtk.vtkTransformPolyDataFilter()
    off_filt.SetInputData(sect_poly)
    off_filt.SetTransform(off_trans)
    off_filt.Update()

    # 2. Prepara os dados da linha de centro
    beam_pts = np.array(beam_data['points']).reshape(-1, 3)
    
    # Coletor para juntar todos os segmentos extrudados
    append_filter = vtk.vtkAppendPolyData()

    # 3. Processa cada segmento
    for seg in beam_data['connectivity']:
        p1, p2 = beam_pts[seg[0]], beam_pts[seg[1]]
        vec = p2 - p1
        length = np.linalg.norm(vec)
        if length < 1e-6: continue
        dir_v = vec / length

        # Orientação (Quaternion math implícito no RotateWXYZ)
        trans = vtk.vtkTransform()
        trans.Translate(p1)
        v_ref = np.array([1.0, 0.0, 0.0])
        axis = np.cross(v_ref, dir_v)
        angle = np.degrees(np.arccos(np.clip(np.dot(v_ref, dir_v), -1.0, 1.0)))
        
        if np.linalg.norm(axis) > 1e-6: 
            trans.RotateWXYZ(angle, axis)
        elif np.dot(v_ref, dir_v) < 0: 
            trans.RotateWXYZ(180, [0, 1, 0])

        t_filt = vtk.vtkTransformPolyDataFilter()
        t_filt.SetInputData(off_filt.GetOutput())
        t_filt.SetTransform(trans)
        
        # Extrusão Linear
        extruder = vtk.vtkLinearExtrusionFilter()
        extruder.SetInputConnection(t_filt.GetOutputPort())
        extruder.SetExtrusionTypeToVectorExtrusion()
        extruder.SetVector(dir_v)
        extruder.SetScaleFactor(length)
        extruder.Update()

        # Cópia profunda para o append
        poly_copy = vtk.vtkPolyData()
        poly_copy.DeepCopy(extruder.GetOutput())
        append_filter.AddInputData(poly_copy)

    # 4. Finaliza e Salva
    append_filter.Update()
    final_mesh = append_filter.GetOutput()
    
    if final_mesh.GetNumberOfPoints() > 0:
        json_output = vtk_dataset_to_dict(final_mesh)
        save_json(json_output, output_path)

def process_shell_headless(data, output_path):
    """
    Gera a geometria 3D (sólida) das cascas.
    APLICA A CORREÇÃO DE SERRILHADO DO SEU SCRIPT (Normals -> Warp -> Extrude).
    """
    # 1. Reconstrói a malha original no VTK
    pts = vtk.vtkPoints()
    p_list = data['points']
    for i in range(0, len(p_list), 3):
        pts.InsertNextPoint(p_list[i], p_list[i+1], p_list[i+2])
    
    grid = vtk.vtkUnstructuredGrid()
    grid.SetPoints(pts)
    for cell in data['connectivity']:
        grid.InsertNextCell(data['vtk_type'], len(cell), cell)

    # 2. Converte UnstructuredGrid -> PolyData (Geometria de Superfície)
    geom = vtk.vtkGeometryFilter()
    geom.SetInputData(grid)
    
    # 3. CRÍTICO: Calcula Normais (AQUI ESTÁ A CORREÇÃO DO SERRILHADO)
    norm = vtk.vtkPolyDataNormals()
    norm.SetInputConnection(geom.GetOutputPort())
    # Opcional: SplittingOff garante que vértices compartilhados tenham a mesma normal
    # norm.SplittingOff() 
    
    # 4. Aplica Offset (Baseado nas Normais)
    warp = vtk.vtkWarpVector()
    warp.SetInputConnection(norm.GetOutputPort())
    warp.SetInputArrayToProcess(0, 0, 0, 0, vtk.vtkDataSetAttributes.NORMALS)
    warp.SetScaleFactor(SHELL_OFFSET - (SHELL_THICKNESS / 2.0))
    
    # 5. Extrusão na direção da Normal (Normal Extrusion)
    ext = vtk.vtkLinearExtrusionFilter()
    ext.SetInputConnection(warp.GetOutputPort())
    ext.SetExtrusionTypeToNormalExtrusion()
    ext.SetScaleFactor(SHELL_THICKNESS)
    ext.Update()

    # 6. Salva
    final_mesh = ext.GetOutput()
    if final_mesh.GetNumberOfPoints() > 0:
        json_output = vtk_dataset_to_dict(final_mesh)
        save_json(json_output, output_path)

def run_processing(dir_alvo):
    """
    Função principal.
    Gera arquivos *_extrusion.json para visualização 3D.
    """
    if not os.path.exists(dir_alvo):
        print(f"[ERRO] Pasta não encontrada: {dir_alvo}")
        return

    print(f"--- Processamento de Geometria VTK (Headless) ---")
    
    # 1. Processamento de Vigas (Requer section_mesh.json)
    path_beam = os.path.join(dir_alvo, "beam.json")
    path_sect = os.path.join(dir_alvo, "section_mesh.json")
    path_out_beam = os.path.join(dir_alvo, "beam_extrusion.json")

    # Verifica se beam existe e processa
    if os.path.exists(path_beam) and os.path.exists(path_sect):
        print("Processando Vigas (Beam -> 3D)...")
        beam_j = load_json(path_beam)
        sect_j = load_json(path_sect)
        if beam_j and sect_j:
            process_beam_headless(beam_j, sect_j, path_out_beam)

    # 2. Processamento de Cascas (Shells)
    files = [f for f in os.listdir(dir_alvo) if f.endswith('.json')]
    # Ignora arquivos de sistema e os que acabamos de gerar
    ignore_list = ['beam.json', 'section_mesh.json', 'project.json', 'package.json', 'tsconfig.json', 'mesh_groups.json']
    
    for f in files:
        if f in ignore_list or f.endswith('_extrusion.json'):
            continue
            
        full_path = os.path.join(dir_alvo, f)
        data = load_json(full_path)
        
        if not data: continue
        v_type = data.get('vtk_type')
        
        # Se for CASCA (Triângulo=5 ou Quad=9)
        if v_type in [5, 9]:
            out_name = os.path.splitext(f)[0] + "_extrusion.json"
            out_path = os.path.join(dir_alvo, out_name)
            print(f"Processando Casca: {f} -> {out_name}")
            process_shell_headless(data, out_path)

    print("--- Processamento Concluído ---")

if __name__ == "__main__":
    # Permite rodar diretamente passando a pasta como argumento
    path_arg = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\jorge\OneDrive\ProSolveSimulation\testcases\hibrido"
    run_processing(path_arg)