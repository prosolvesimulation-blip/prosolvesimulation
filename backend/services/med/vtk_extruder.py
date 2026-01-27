import os
import subprocess
import json
import vtk
import numpy as np
from vtk.util import numpy_support

# ==============================================================================
# PATH CONFIGURATION (SALOME / MED ENVIRONMENT)
# ==============================================================================
# We assume this script lives in: backend/services/med/vtk_extruder.py
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
# backend root
BACKEND_DIR = os.path.dirname(os.path.dirname(THIS_DIR))
# project root
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
# Salome / MEDCoupling environment
MED_ENV_DIR = os.path.join(PROJECT_ROOT, "MEDCOUPLING-9.15.0", "MEDCOUPLING-9.15.0")
# Standalone Mesher Script in the same directory
MESHER_SCRIPT = os.path.join(THIS_DIR, "med_mesher.py")

# VTK type mapping for point counts (used for backup/auto-detect if needed)
VTK_NODES_MAP = {
    3: 2,   # VTK_LINE
    5: 3,   # VTK_TRIANGLE
    9: 4,   # VTK_QUAD
    10: 4,  # VTK_TETRA
    12: 8   # VTK_HEXAHEDRON
}

def vtk_dataset_to_dict(vtk_data):
    """
    Converte um objeto VTK processado (PolyData) de volta para o formato JSON.
    """
    if not vtk_data or vtk_data.GetNumberOfPoints() == 0:
        return {"status": "empty", "points": [], "connectivity": []}

    # 1. Extrair Pontos
    points_array = vtk_data.GetPoints().GetData()
    numpy_points = numpy_support.vtk_to_numpy(points_array)
    points_list = numpy_points.flatten().tolist()

    # 2. Extrair Conectividade
    connectivity_list = []
    num_cells = vtk_data.GetNumberOfCells()
    
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

def normalize_line_connectivity(connectivity, points):
    """
    Garante que todos os segmentos de linha apontem na mesma direção dominante.
    Evita 'flips' no sistema de coordenadas local durante a extrusão.
    """
    if not connectivity or len(connectivity) < 1:
        return connectivity

    # 1. Calcula a direção média do grupo (Referência Dominante)
    avg_dir = np.zeros(3)
    valid_count = 0
    for seg in connectivity:
        if len(seg) < 2: continue
        p1, p2 = points[seg[0]], points[seg[1]]
        vec = p2 - p1
        if np.linalg.norm(vec) > 1e-6:
            avg_dir += (vec / np.linalg.norm(vec))
            valid_count += 1
    
    if valid_count == 0: return connectivity
    avg_dir /= valid_count
    
    # 2. Normaliza a conectividade: Se o segmento estiver contra a média, inverte.
    new_conn = []
    for seg in connectivity:
        if len(seg) < 2:
            new_conn.append(seg)
            continue
        p1, p2 = points[seg[0]], points[seg[1]]
        vec = p2 - p1
        if np.dot(vec, avg_dir) < -1e-6:
            # Inverte direção
            new_conn.append([seg[1], seg[0]])
        else:
            new_conn.append(seg)
            
    return new_conn

def extrude_beam_memory(beam_data, section_mesh, params):
    """
    Gera a geometria 3D das vigas (Sweep/Extrude) usando dados em memória.
    """
    # 1. Prepara a Seção Transversal (2D da memória)
    s_pts = vtk.vtkPoints()
    
    # section_mesh['vertices'] é tipicamente [[y1, z1], [y2, z2], ...]
    verts = section_mesh['vertices']
    if len(verts) > 0 and isinstance(verts[0], (list, tuple)):
        for v in verts:
            s_pts.InsertNextPoint(0, float(v[0]), float(v[1]))
    else:
        # Fallback para flat list [y1, z1, y2, z2, ...]
        for i in range(0, len(verts), 2):
            s_pts.InsertNextPoint(0, float(verts[i]), float(verts[i+1]))
    
    sect_poly = vtk.vtkPolyData()
    sect_poly.SetPoints(s_pts)
    cells = vtk.vtkCellArray()
    for tri in section_mesh['triangles']:
        cells.InsertNextCell(len(tri), tri)
    sect_poly.SetPolys(cells)

    # NOTE: Double offset fix. 
    # The section_mesh vertices already include offset_y and offset_z
    # because section_calculator.py applies them. 
    # Applying them again here would double the displacement.
    off_filt_output = sect_poly

    # 2. Prepara os dados da linha de centro
    beam_pts = np.array(beam_data['points']).reshape(-1, 3)
    
    # NORMALIZAÇÃO: Garante que todos os segmentos apontem na mesma direção dominante.
    # Isso evita flips nos eixos locais (Y/Z) que causariam 'ziguezague' no offset.
    normalized_conn = normalize_line_connectivity(beam_data['connectivity'], beam_pts)
    
    append_filter = vtk.vtkAppendPolyData()

    # 3. Processa cada segmento
    for seg in normalized_conn:
        if len(seg) < 2: continue
        p1, p2 = beam_pts[seg[0]], beam_pts[seg[1]]
        vec = p2 - p1
        length = np.linalg.norm(vec)
        if length < 1e-6: continue
        dir_v = vec / length

        # ORIENTAÇÃO ROBUSTA (Eixo X alinhado com dir_v + Roll controlado)
        # x_axis = dir_v
        # y_axis = perpendicular ao x_axis e ao "Up" global
        # z_axis = finaliza o sistema ortonormal (alinhado com o "Up" global)
        
        x_axis = dir_v
        up_ref = np.array([0.0, 0.0, 1.0])
        
        # Caso a viga seja vertical, usamos o eixo Y como referência para evitar singularidade
        if abs(np.dot(x_axis, up_ref)) > 0.99:
            up_ref = np.array([0.0, 1.0, 0.0])
            
        y_axis = np.cross(up_ref, x_axis)
        y_axis /= np.linalg.norm(y_axis)
        z_axis = np.cross(x_axis, y_axis)
        z_axis /= np.linalg.norm(z_axis)
        
        # Monta a matriz de transformação 4x4
        # Mapeia: Local X(1,0,0) -> x_axis, Local Y(0,1,0) -> y_axis, Local Z(0,0,1) -> z_axis
        mat = vtk.vtkMatrix4x4()
        for i in range(3):
            mat.SetElement(i, 0, x_axis[i])
            mat.SetElement(i, 1, y_axis[i])
            mat.SetElement(i, 2, z_axis[i])
            mat.SetElement(i, 3, p1[i])
            
        trans = vtk.vtkTransform()
        trans.SetMatrix(mat)

        t_filt = vtk.vtkTransformPolyDataFilter()
        t_filt.SetInputData(off_filt_output)
        t_filt.SetTransform(trans)
        
        # Extrusão Linear
        extruder = vtk.vtkLinearExtrusionFilter()
        extruder.SetInputConnection(t_filt.GetOutputPort())
        extruder.SetExtrusionTypeToVectorExtrusion()
        extruder.SetVector(dir_v)
        extruder.SetScaleFactor(length)
        extruder.Update()

        poly_copy = vtk.vtkPolyData()
        poly_copy.DeepCopy(extruder.GetOutput())
        append_filter.AddInputData(poly_copy)

    append_filter.Update()
    return vtk_dataset_to_dict(append_filter.GetOutput())

def extrude_shell_memory(data, params):
    """
    Gera a geometria 3D (sólida) das cascas usando parâmetros da memória.
    """
    thickness = float(params.get('thickness', 10.0))
    offset = float(params.get('offset', 0.0))

    # 1. Reconstrói a malha original no VTK
    pts = vtk.vtkPoints()
    p_list = data['points']
    for i in range(0, len(p_list), 3):
        pts.InsertNextPoint(p_list[i], p_list[i+1], p_list[i+2])
    
    grid = vtk.vtkUnstructuredGrid()
    grid.SetPoints(pts)
    for cell in data['connectivity']:
        grid.InsertNextCell(data['vtk_type'], len(cell), cell)

    # 2. Converte UnstructuredGrid -> PolyData
    geom = vtk.vtkGeometryFilter()
    geom.SetInputData(grid)
    
    # 3. Calcula Normais
    norm = vtk.vtkPolyDataNormals()
    norm.SetInputConnection(geom.GetOutputPort())
    norm.ComputePointNormalsOn()
    norm.ComputeCellNormalsOff()
    norm.AutoOrientNormalsOn()
    norm.ConsistencyOn()
    norm.SplittingOff()
    
    # 4. Aplica Offset (Centralizado ou conforme parâmetro)
    warp = vtk.vtkWarpVector()
    warp.SetInputConnection(norm.GetOutputPort())
    warp.SetInputArrayToProcess(0, 0, 0, 0, vtk.vtkDataSetAttributes.NORMALS)
    # Escala inicial para mover a face base para a posição correta (considerando offset e metade da espessura)
    warp.SetScaleFactor(offset - (thickness / 2.0))
    
    # 5. Extrusão na direção da Normal
    ext = vtk.vtkLinearExtrusionFilter()
    ext.SetInputConnection(warp.GetOutputPort())
    ext.SetExtrusionTypeToNormalExtrusion()
    ext.SetScaleFactor(thickness)
    ext.Update()

    return vtk_dataset_to_dict(ext.GetOutput())

# ==============================================================================
# PIPELINE ORCHESTRATION (med_mesher -> vtk_extruder)
# ==============================================================================

def call_med_mesher(file_path):
    """
    Executes med_mesher.py within the SALOME environment and returns the parsed JSON.
    Purely in-memory capture via STDOUT.
    """
    if not os.path.exists(MED_ENV_DIR):
        print(f"[VTK-EXTRUDER] Error: MEDCOUPLING directory not found at {MED_ENV_DIR}")
        return {"status": "error", "message": "MEDCoupling environment missing"}
        
    try:
        # Build command: cd to env -> call launch -> run mesher
        # Note: We use absolute paths and quote them for safety
        cmd = (
            f'cmd /c "cd /d \"{MED_ENV_DIR}\" && '
            f'call env_launch.bat && '
            f'python \"{MESHER_SCRIPT}\" \"{file_path}\""'
        )
        
        print(f"[VTK-EXTRUDER] Executing med_mesher standalone...")
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
        
        if result.returncode == 0:
            output = result.stdout
            if "__JSON_START__" in output and "__JSON_END__" in output:
                json_str = output.split("__JSON_START__")[1].split("__JSON_END__")[0]
                return json.loads(json_str)
            else:
                print(f"[VTK-EXTRUDER] Error: Invalid output format from mesher: {output}")
        else:
            print(f"[VTK-EXTRUDER] Mesher process failed: {result.stderr}")
            
    except Exception as e:
        print(f"[VTK-EXTRUDER] Subprocess Exception: {e}")
        
    return {"status": "error", "message": "Mesh extraction failed"}

def med_to_vtk_pipeline(file_path, geometries=[]):
    """
    THE PIPELINE: med_mesher -> vtk_extruder logic.
    1. Extracts 'clean' structured mesh data via med_mesher.
    2. Applies in-memory extrusion/visual processing.
    """
    try:
        if not os.path.exists(file_path):
            return {"status": "error", "message": f"File not found: {file_path}"}

        # 1. OBTAIN CLEAN DATA (Groups already structured as List of Lists)
        med_res = call_med_mesher(file_path)
        if med_res.get("status") != "success":
            return med_res

        mesh_groups = med_res.get("groups", {})
        
        # 2. IDENTIFY MASTER POINTS (for offset calculations)
        full_mesh = mesh_groups.get("_FULL_MESH_")
        if not full_mesh and len(mesh_groups) > 0:
            full_mesh = list(mesh_groups.values())[0]
            
        if not full_mesh:
             return {"status": "error", "message": "No valid mesh groups found"}

        points = full_mesh.get("points", [])
        
        # Build lookup map for geometry configs
        geom_map = {}
        for g in geometries:
            group_name = g.get('group')
            if group_name:
                geom_map[str(group_name).strip().upper()] = g

        final_points = list(points)
        final_cells = {}

        # 3. APPLY EXTRUSION LOGIC PER GROUP
        for g_name, g_data in mesh_groups.items():
            if g_name == "_FULL_MESH_": continue

            connectivity = g_data.get("connectivity", [])
            vtk_type = g_data.get("vtk_type", 0)
            
            # Map Config
            geom_config = geom_map.get(str(g_name).strip().upper())
            params = geom_config.get('section_params', {}) if geom_config else {}
            
            # Identify Category
            cell_type_str = {3:'line', 5:'triangle', 9:'quad', 10:'tetra', 12:'hexa', 1:'vertex'}.get(vtk_type, 'unknown')
            category = geom_config.get('_category') if geom_config else None
            
            print(f"[PIPELINE] Group: {g_name} | Type: {cell_type_str} | ConfigFound: {bool(geom_config)} | Category: {category}")

            if not category:
                if cell_type_str == 'line': category = '1D'
                elif cell_type_str in ('triangle', 'quad'): category = '2D'
                else: category = '3D'
                print(f"[PIPELINE] Auto-detected Category: {category}")


            # --- PROCESS BEAMS ---
            if category == '1D' and cell_type_str == 'line' and geom_config and geom_config.get('section_mesh'):
                print(f"[PIPELINE] EXTRUDING BEAM: {g_name}")
                section_mesh = geom_config.get('section_mesh') # Vertices / Triangles from state
                
                beam_input = {
                    "points": points,
                    "connectivity": connectivity
                }
                
                res = extrude_beam_memory(beam_input, section_mesh, params)
                
                # Always keep the ORIGINAL 1D mesh
                final_cells[g_name] = {
                    "type": "line", 
                    "vtk_type": 3,
                    "connectivity": connectivity, 
                    "is_extruded": False,
                    "is_base": True
                }

                if res.get("status") != "empty":
                    base_idx = len(final_points) // 3
                    final_points.extend(res["points"])
                    translated_conn = [[idx + base_idx for idx in cell] for cell in res["connectivity"]]
                    final_cells[f"{g_name}_EXTRUSION"] = {
                        "type": "quad", 
                        "vtk_type": 9, # VTK_QUAD
                        "connectivity": translated_conn, 
                        "is_extruded": True,
                        "is_base": False
                    }

            # --- PROCESS SHELLS ---
            elif category == '2D' and float(params.get('thickness', 0)) > 0:
                print(f"[VTK-EXTRUDER] Processing Shell Extrusion: {g_name}")
                
                shell_input = {
                    "points": points,
                    "connectivity": connectivity,
                    "vtk_type": vtk_type
                }
                
                res = extrude_shell_memory(shell_input, params)
                
                # Always keep the ORIGINAL 2D mesh
                final_cells[g_name] = {
                    "type": cell_type_str, 
                    "vtk_type": vtk_type,
                    "connectivity": connectivity, 
                    "is_extruded": False,
                    "is_base": True
                }

                if res.get("status") != "empty":
                    base_idx = len(final_points) // 3
                    final_points.extend(res["points"])
                    translated_conn = [[idx + base_idx for idx in cell] for cell in res["connectivity"]]
                    final_cells[f"{g_name}_EXTRUSION"] = {
                        "type": "quad", 
                        "vtk_type": 9, # VTK_QUAD
                        "connectivity": translated_conn, 
                        "is_extruded": True,
                        "is_base": False
                    }
                    
            # --- PASS-THROUGH (Solid/Other) ---
            else:
                print(f"[PIPELINE] SKIPPING EXTRUSION for {g_name} (category={category}, cell={cell_type_str})")
                final_cells[g_name] = {
                    "type": cell_type_str,
                    "vtk_type": vtk_type,
                    "connectivity": connectivity,
                    "is_extruded": False,
                    "is_base": True
                }

        return {
            "status": "success",
            "points": final_points,
            "cells": final_cells,
            "num_points": len(final_points) // 3,
            "num_groups": len(final_cells)
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": f"Pipeline execution failed: {e}"}
