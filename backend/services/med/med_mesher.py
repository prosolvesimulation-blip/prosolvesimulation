#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MedMesher Standalone (Background)
Processes .med files, extracts Full Mesh AND Groups, fixes 'Spiderweb' connectivity,
and saves individual JSON files per component.
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

def process_connectivity(raw_conn_flat, num_cells):
    """
    🕸️ SPIDERWEB FIX: Limpa a conectividade removendo prefixos de tamanho/tipo.
    Transforma lista plana em Lista de Listas [[n1,n2,n3], ...].
    """
    if num_cells <= 0 or not raw_conn_flat:
        return []

    total_len = len(raw_conn_flat)
    nodes_per_elem_total = total_len // num_cells
    
    cleaned_connectivity = []
    
    for i in range(num_cells):
        # Fatia o chunk correspondente ao elemento
        chunk = raw_conn_flat[i * nodes_per_elem_total : (i + 1) * nodes_per_elem_total]
        
        # Lógica de Correção:
        # Se temos mais de 1 item, o primeiro geralmente é o prefixo (Ex: [3, n1, n2, n3])
        # Padrão MED/VTK para tipos variados.
        if len(chunk) > 1:
            cleaned_connectivity.append(chunk[1:]) # Pula o prefixo (Spiderweb Fix)
        else:
            cleaned_connectivity.append(chunk)
            
    return cleaned_connectivity

def extract_mesh_data(file_path):
    """Extrai dados (Full + Groups), corrige conectividade e retorna dicionário."""
    
    if not os.path.exists(file_path):
        return {"status": "error", "message": f"File not found: {file_path}"}
    if ml is None:
        return {"status": "error", "message": "MEDCoupling unavailable"}

    try:
        mesh_names = ml.GetMeshNames(file_path)
        if not mesh_names: return {"status": "error", "message": "No meshes found"}
        mesh_name = mesh_names[0]
        
        # 1. PREPARAR DICIONÁRIO DE EXPORTAÇÃO
        export_targets = {} 
        results = {}

        # --- A. MALHA COMPLETA (Base) ---
        try:
            full_mesh = ml.ReadUMeshFromFile(file_path, mesh_name, 0)
            if full_mesh.getNumberOfCells() > 0:
                export_targets["_FULL_MESH_"] = full_mesh
        except: pass

        # --- B. GRUPOS (Sub-malhas) ---
        group_names = ml.GetMeshGroupsNames(file_path, mesh_name)
        for g_name in group_names:
            try:
                sub_mesh = ml.ReadUMeshFromGroups(file_path, mesh_name, 0, [g_name])
                if sub_mesh.getNumberOfCells() > 0:
                    export_targets[g_name] = sub_mesh
            except: pass

        # 2. PROCESSAMENTO
        for key, mesh_obj in export_targets.items():
            num_cells = mesh_obj.getNumberOfCells()
            coords = mesh_obj.getCoords().toNumPyArray().flatten().tolist()
            
            conn_obj = mesh_obj.getNodalConnectivity()
            raw_conn = conn_obj.toNumPyArray().flatten().tolist()
            structured_connectivity = process_connectivity(raw_conn, num_cells)

            # VTK Type
            try:
                mc_type = mesh_obj.getTypeOfCell(0)
                mapping = {mc.NORM_SEG2: 3, mc.NORM_TRI3: 5, mc.NORM_QUAD4: 9, mc.NORM_TETRA4: 10, mc.NORM_HEXA8: 12}
                vtk_type = mapping.get(mc_type, 5)
            except: vtk_type = 5

            results[key] = {
                "points": coords,
                "connectivity": structured_connectivity,
                "vtk_type": vtk_type,
                "num_points": len(coords) // 3,
                "num_elements": num_cells
            }

        return {"status": "success", "groups": results}

    except Exception as e:
        return {"status": "error", "message": str(e), "traceback": traceback.format_exc()}

if __name__ == "__main__":
    # Silêncio Total (Apenas o JSON final no stdout, envolto em markers)
    if len(sys.argv) > 1:
        target = sys.argv[1]
        if os.path.isfile(target):
            res = extract_mesh_data(target)
            sys.stdout.write("__JSON_START__")
            sys.stdout.write(json.dumps(res))
            sys.stdout.write("__JSON_END__")
        else:
            sys.stdout.write(json.dumps({"status": "error", "message": "Directory mode not supported"}))
    else:
        sys.stdout.write(json.dumps({"status": "error", "message": "No file path provided"}))
