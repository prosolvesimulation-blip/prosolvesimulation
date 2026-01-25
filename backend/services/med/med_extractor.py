import sys
import os
import json

# ==============================================================================
# MED_EXTRACTOR.PY - PROTOCOLO DE MISSÃO: PONTE DE DADOS (MED -> GLOBAL STATE)
# Objetivo: Gerar o "DNA" da malha para o window.projectState do Frontend.
# Regra: Agnóstico, formatado para consumo via API.
# Ambiente: MEDCOUPLING 9.15.0
# ==============================================================================

try:
    import MEDLoader as ml
    import medcoupling as mc
    import numpy as np
except ImportError:
    # Fail-safe para ambientes externos ao MEDCoupling
    pass

def map_med_to_vtk_protocol(mc_type):
    """Mapeamento rigoroso conforme tabelas VTK."""
    mapping = {
        mc.NORM_SEG2: 3,   # VTK_LINE
        mc.NORM_TRI3: 5,   # VTK_TRIANGLE
        mc.NORM_QUAD4: 9,  # VTK_QUAD
        mc.NORM_TETRA4: 10, # VTK_TETRA
        mc.NORM_HEXA8: 12  # VTK_HEXAHEDRON
    }
    return mapping.get(mc_type, 0)

def extract_med_data(file_path):
    """
    DNA Extractor: Transforma arquivo MED em JSON compatível com Estado Global.
    """
    if not os.path.exists(file_path):
        return {"status": "error", "message": f"File not found: {file_path}"}
        
    try:
        # ETAPA 1: LEITURA HIERÁRQUICA
        mesh_names = ml.GetMeshNames(file_path)
        if not mesh_names:
            return {"status": "error", "message": "No meshes found."}
        
        mesh_name = mesh_names[0]
        group_names = ml.GetMeshGroupsNames(file_path, mesh_name)
        
        results = {}
        
        for g_name in group_names:
            # ETAPA 2: ITERAÇÃO E CLASSIFICAÇÃO DE GRUPOS
            try:
                # 1. Tentar carregar como malha de células (Nível 0)
                sub_mesh = ml.ReadUMeshFromGroups(file_path, mesh_name, 0, [g_name])
                num_cells = sub_mesh.getNumberOfCells()
                
                if num_cells > 0:
                    d_mesh = sub_mesh.getMeshDimension()
                    # Inferência de Categoria (Protocolo)
                    category = {3: "3D", 2: "2D", 1: "1D"}.get(d_mesh, str(d_mesh) + "D")
                    
                    # VTK Type Mapping (da primeira célula)
                    mc_type = sub_mesh.getTypeOfCell(0)
                    vtk_id = map_med_to_vtk_protocol(mc_type)
                    
                    # Otimização de Arrays: Points e Connectivity
                    points = sub_mesh.getCoords().toNumPyArray().flatten().tolist()
                    connectivity = sub_mesh.getNodalConnectivity().toNumPyArray().flatten().tolist()
                    
                    # Normais Condicionais (Protocolo: Apenas 2D)
                    normals = None
                    if category == "2D":
                        try:
                            norm_field = sub_mesh.buildOrthogonalField()
                            normals = norm_field.getArray().toNumPyArray().flatten().tolist()
                        except:
                            normals = None
                    
                    results[g_name] = {
                        "dimension": int(d_mesh),
                        "count": int(num_cells),
                        "category": category,
                        "type_vtk": int(vtk_id),
                        "points": points,
                        "connectivity": connectivity,
                        "normals": normals
                    }
                    continue # Sucesso como grupo de células

            except:
                pass # Pode ser um grupo de nós

            # 2. Tentar carregar como grupo de nós (Se necessário para Restrictions)
            try:
                # Nota: Em algumas versões, grupos de nós são lidado diferentemente. 
                # Se d_mesh falhar acima, classificamos como Node aqui.
                # Para simplificar e seguir o protocolo:
                mfile = ml.MEDFileUMesh.New(file_path, mesh_name)
                # Verifica se g_name é um grupo de nós
                node_arr = mfile.getNodeGroupArr(g_name)
                if node_arr and node_arr.getNumberOfTuples() > 0:
                    results[g_name] = {
                        "dimension": 0,
                        "count": int(node_arr.getNumberOfTuples()),
                        "category": "Node",
                        "type_vtk": 1, # VTK_VERTEX
                        "points": [], # No global state, nodes groups usually reference global points
                        "connectivity": node_arr.toNumPyArray().flatten().tolist(), # IDs dos nós
                        "normals": None
                    }
            except:
                continue

        return {
            "status": "success",
            "filename": os.path.basename(file_path),
            "data": {
                "mesh_name": mesh_name,
                "groups": results
            }
        }
        
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "message": str(e),
            "traceback": traceback.format_exc()
        }

def extract_to_dict(file_path):
    """Protocol Alias for extract_med_data"""
    return extract_med_data(file_path)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(1)
    
    input_med = sys.argv[1]
    output_json = sys.argv[2] if len(sys.argv) > 2 else None
    
    result_data = extract_med_data(input_med)
    
    # OUTPUT DUPLO
    # 1. Stdout Minificado (Produção)
    print(json.dumps(result_data, separators=(',', ':')))
    
    # 2. Arquivo (Opcional - Debug)
    if output_json:
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, indent=2)
