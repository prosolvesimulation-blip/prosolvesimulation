import sys
import os
import json

# ==============================================================================
# MED_EXTRACTOR.PY - PROTOCOLO DE MISSÃO: PONTE DE DADOS (MED -> GLOBAL STATE)
# Objetivo: Gerar o "DNA" da malha para o window.projectState do Frontend.
# Atualização: Extrai _FULL_MESH_ + Grupos Individuais.
# ==============================================================================

try:
    import MEDLoader as ml
    import medcoupling as mc
    import numpy as np
except ImportError:
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
    DNA Extractor: Transforma arquivo MED em dict com Malha Base + Grupos.
    Retorna estrutura:
    {
       "data": {
           "groups": {
               "_FULL_MESH_": { ... },
               "Group_1": { ... }
           }
       }
    }
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

        # =====================================================================
        # ETAPA 1.5: EXTRAÇÃO DA MALHA COMPLETA (TUDÃO - _FULL_MESH_)
        # =====================================================================
        try:
            full_mesh = ml.ReadUMeshFromFile(file_path, mesh_name, 0)
            if full_mesh.getNumberOfCells() > 0:
                results["_FULL_MESH_"] = _extract_mesh_components(full_mesh)
        except Exception as e:
            sys.stderr.write(f"[WARN] Full mesh extraction failed: {e}\n")

        # =====================================================================
        # ETAPA 2: ITERAÇÃO E CLASSIFICAÇÃO DE GRUPOS
        # =====================================================================
        for g_name in group_names:
            try:
                # Tenta carregar como malha de células
                sub_mesh = ml.ReadUMeshFromGroups(file_path, mesh_name, 0, [g_name])
                if sub_mesh.getNumberOfCells() > 0:
                    results[g_name] = _extract_mesh_components(sub_mesh)
                    continue 
            except:
                pass 

            # Tenta carregar como grupo de nós (Opcional, se necessário)
            try:
                mfile = ml.MEDFileUMesh.New(file_path, mesh_name)
                node_arr = mfile.getNodeGroupArr(g_name)
                if node_arr and node_arr.getNumberOfTuples() > 0:
                    results[g_name] = {
                        "dimension": 0,
                        "count": int(node_arr.getNumberOfTuples()),
                        "category": "Node",
                        "vtk_type": 1,
                        "points": [],
                        "connectivity": node_arr.toNumPyArray().flatten().tolist(), # Node IDs
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

def _extract_mesh_components(mesh_obj):
    """Helper para extrair componentes comuns de um objeto Mesh."""
    num_cells = mesh_obj.getNumberOfCells()
    d_mesh = mesh_obj.getMeshDimension()
    category = {3: "3D", 2: "2D", 1: "1D"}.get(d_mesh, str(d_mesh) + "D")
    
    mc_type = mesh_obj.getTypeOfCell(0)
    vtk_id = map_med_to_vtk_protocol(mc_type)
    
    points = mesh_obj.getCoords().toNumPyArray().flatten().tolist()
    
    # NOTA: Retornamos o array raw aqui. A limpeza (Spiderweb Fix) 
    # será feita no Mesher ou no loop final para garantir controle.
    connectivity_raw = mesh_obj.getNodalConnectivity().toNumPyArray().flatten().tolist()
    
    normals = None
    if category == "2D":
        try:
            norm_field = mesh_obj.buildOrthogonalField()
            normals = norm_field.getArray().toNumPyArray().flatten().tolist()
        except:
            normals = None
            
    return {
        "dimension": int(d_mesh),
        "count": int(num_cells),
        "category": category,
        "vtk_type": int(vtk_id),
        "points": points,
        "connectivity_raw": connectivity_raw, # Nomeado RAW para indicar que precisa de processamento
        "normals": normals
    }

def extract_to_dict(file_path):
    return extract_med_data(file_path)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(1)
    
    input_med = sys.argv[1]
    output_json = sys.argv[2] if len(sys.argv) > 2 else None
    
    result_data = extract_med_data(input_med)
    
    print(json.dumps(result_data, separators=(',', ':')))
    
    if output_json:
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, indent=2)