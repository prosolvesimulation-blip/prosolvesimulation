#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MedMesher Standalone (Background)
Processes .med files in testcases/hibrido and generates individual JSON files.
Systeem: 1 Call per Mesh, 1 JSON per Mesh.
"""
import sys
import os
import json
import traceback

try:
    import MEDLoader as ml
    import medcoupling as mc
    import numpy as np
except ImportError:
    ml = None
    mc = None

def extract_single_mesh(file_path):
    """Extracts points and structured connectivity using ml/mc module functions."""
    if not os.path.exists(file_path):
        return {"status": "error", "message": f"File not found: {file_path}"}
        
    if ml is None or mc is None:
        return {"status": "error", "message": "MEDCoupling modules (MEDLoader/medcoupling) not available"}

    try:
        # 1. LEITURA HIERÁRQUICA (Protocolo med_extractor)
        mesh_names = ml.GetMeshNames(file_path)
        if not mesh_names:
            return {"status": "error", "message": "No meshes found in MED file"}
        
        mesh_name = mesh_names[0]
        
        # Carregar Malha Completa (Nível 0)
        # ReadUMeshFromFile(fileName, meshName, iteration)
        mesh = ml.ReadUMeshFromFile(file_path, mesh_name, 0)
        
        if mesh is None:
            return {"status": "error", "message": "ReadUMeshFromFile returned None"}

        # 2. EXTRACT POINTS
        coords = mesh.getCoords()
        points = coords.toNumPyArray().flatten().tolist()

        # 3. EXTRACT CONNECTIVITY (Structured - No Flatten!)
        num_cells = mesh.getNumberOfCells()
        conn_obj = mesh.getNodalConnectivity()
        connectivity = []

        if conn_obj is not None:
            raw_conn = conn_obj.toNumPyArray()
            if num_cells > 0:
                if len(raw_conn.shape) > 1:
                    connectivity = raw_conn.tolist()
                else:
                    # Flat list -> element-by-element chunking
                    total_len = len(raw_conn)
                    nodes_per_elem_total = total_len // num_cells
                    flat_list = raw_conn.tolist()
                    
                    connectivity = []
                    for i in range(num_cells):
                        chunk = flat_list[i * nodes_per_elem_total : (i + 1) * nodes_per_elem_total]
                        # 🕸️ FIX SPIDERWEB (Enhanced): 
                        # Strip prefix if it exists. Common patterns:
                        # 1. Size prefix: [N, node1, ..., nodeN] (chunk[0] == N)
                        # 2. Type prefix: [TypeID, node1, ..., nodeN] (seen in solids, chunk[0] != N)
                        if len(chunk) > 1:
                            # If we have N+1 items, the first is almost certainly a prefix (Size or Type)
                            # Most standard finite elements (Beam2, Quad4, Hexa8) come in N+1 or N chunks.
                            # We assume N+1 indicates a prefix.
                            connectivity.append(chunk[1:])
                        else:
                            connectivity.append(chunk)

        # 4. EXTRACT NORMALS (Conditionals)
        normals = None
        try:
            # buildOrthogonalField calculates normals for the mesh
            norm_field = mesh.buildOrthogonalField()
            if norm_field:
                normals = norm_field.getArray().toNumPyArray().flatten().tolist()
        except:
            normals = None

        # 5. GET VTK TYPE
        # Use first cell type
        vtk_type = 5 # Default
        if num_cells > 0:
            try:
                mc_type = mesh.getTypeOfCell(0)
                # Mapping conform med_extractor
                mapping = {
                    mc.NORM_SEG2: 3, mc.NORM_TRI3: 5, mc.NORM_QUAD4: 9,
                    mc.NORM_TETRA4: 10, mc.NORM_HEXA8: 12
                }
                vtk_type = mapping.get(mc_type, 5)
            except: pass

        return {
            "status": "success",
            "filename": os.path.basename(file_path),
            "points": points,
            "connectivity": connectivity,
            "normals": normals,
            "vtk_type": vtk_type,
            "num_points": len(points) // 3,
            "num_elements": len(connectivity)
        }
    except Exception as e:
        return {"status": "error", "message": f"{type(e).__name__}: {str(e)}", "traceback": traceback.format_exc()}

def process_directory(dir_path):
    """Scans and processes all .med files in the directory."""
    print(f"\n[START] Scanning directory: {dir_path}")
    
    if not os.path.exists(dir_path):
        print(f"[ABORT] Path does not exist: {dir_path}")
        return

    files = [f for f in os.listdir(dir_path) if f.lower().endswith('.med') and 'resu' not in f.lower()]
    print(f"[FOUND] {len(files)} mesh files to process.\n")

    for f_name in files:
        full_path = os.path.join(dir_path, f_name)
        json_path = os.path.join(dir_path, f_name.replace('.med', '.json'))
        
        print(f"[PROCESS] Extracting: {f_name}...")
        result = extract_single_mesh(full_path)
        
        if result["status"] == "success":
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, separators=(',', ':'))
            print(f"[SUCCESS] Saved to: {os.path.basename(json_path)} ({result['num_points']} nodes, {result['num_elements']} elements)")
        else:
            print(f"[ERROR] Failed {f_name}: {result['message']}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        path = sys.argv[1]
        if os.path.exists(path) and path.lower().endswith('.med'):
            json_path = path.replace('.med', '.json')
            result = extract_single_mesh(path)
            if result["status"] == "success":
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(result, f, separators=(',', ':'))
                print(f"[EXTRACT] Success: {os.path.basename(json_path)}")
                sys.exit(0)
            else:
                print(f"[EXTRACT] Error: {result['message']}")
                sys.exit(1)

    # Batch processing of hibrido folder
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    target_dir = os.path.join(base_dir, "testcases", "hibrido")
    
    process_directory(target_dir)
    print("\n[FINISH] Background processing completed.")
