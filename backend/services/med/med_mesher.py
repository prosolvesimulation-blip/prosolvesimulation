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

def extract_and_save_mesh(file_path, output_dir):
    """Extrai dados (Full + Groups), corrige conectividade e salva JSONs."""
    
    if not os.path.exists(file_path):
        return {"status": "error", "message": f"File not found: {file_path}"}
    if ml is None:
        return {"status": "error", "message": "MEDCoupling unavailable"}

    try:
        mesh_names = ml.GetMeshNames(file_path)
        if not mesh_names: return {"status": "error", "message": "No meshes found"}
        mesh_name = mesh_names[0]
        
        # 1. PREPARAR DICIONÁRIO DE EXPORTAÇÃO
        # Vamos coletar tudo que precisa ser salvo aqui
        export_targets = {} # { suffix: data_dict }

        # --- A. MALHA COMPLETA (Base) ---
        try:
            full_mesh = ml.ReadUMeshFromFile(file_path, mesh_name, 0)
            if full_mesh.getNumberOfCells() > 0:
                export_targets["_FULL_MESH_"] = full_mesh
        except Exception as e:
            print(f"[WARN] Full mesh read error: {e}")

        # --- B. GRUPOS (Sub-malhas) ---
        group_names = ml.GetMeshGroupsNames(file_path, mesh_name)
        for g_name in group_names:
            try:
                sub_mesh = ml.ReadUMeshFromGroups(file_path, mesh_name, 0, [g_name])
                if sub_mesh.getNumberOfCells() > 0:
                    export_targets[g_name] = sub_mesh
            except: pass

        # 2. PROCESSAMENTO E SALVAMENTO
        base_filename = os.path.splitext(os.path.basename(file_path))[0]
        saved_files = []

        for key, mesh_obj in export_targets.items():
            # Extração de Dados Básicos
            num_cells = mesh_obj.getNumberOfCells()
            coords = mesh_obj.getCoords().toNumPyArray().flatten().tolist()
            
            # --- O PULO DO GATO: CONECTIVIDADE ---
            conn_obj = mesh_obj.getNodalConnectivity()
            raw_conn = conn_obj.toNumPyArray().flatten().tolist()
            
            # APLICAR O FIX "SPIDERWEB" AQUI
            # Transforma raw flat list em lista de listas limpa
            structured_connectivity = process_connectivity(raw_conn, num_cells)

            # Normais
            normals = None
            d_mesh = mesh_obj.getMeshDimension()
            category = {3: "3D", 2: "2D", 1: "1D"}.get(d_mesh, str(d_mesh) + "D")
            if category == "2D":
                try:
                    norm_field = mesh_obj.buildOrthogonalField()
                    normals = norm_field.getArray().toNumPyArray().flatten().tolist()
                except: pass

            # VTK Type
            try:
                mc_type = mesh_obj.getTypeOfCell(0)
                mapping = {mc.NORM_SEG2: 3, mc.NORM_TRI3: 5, mc.NORM_QUAD4: 9, mc.NORM_TETRA4: 10, mc.NORM_HEXA8: 12}
                vtk_type = mapping.get(mc_type, 5)
            except: vtk_type = 5

            # Definição do Nome do Arquivo
            if key == "_FULL_MESH_":
                suffix = "" # shell.json
            else:
                safe_key = key.replace(" ", "_").replace("/", "-")
                suffix = f"_{safe_key}" # shell_Group.json

            final_name = f"{base_filename}{suffix}.json"
            final_path = os.path.join(output_dir, final_name)

            # Payload Final
            payload = {
                "status": "success",
                "filename": os.path.basename(file_path),
                "group_name": key,
                "points": coords,
                "connectivity": structured_connectivity, # Agora está LIMPO e ESTRUTURADO
                "normals": normals,
                "vtk_type": vtk_type,
                "num_points": len(coords) // 3,
                "num_elements": num_cells
            }

            with open(final_path, 'w', encoding='utf-8') as f:
                json.dump(payload, f, separators=(',', ':'))
            
            saved_files.append(final_name)
            print(f"   -> Saved: {final_name} (Elem: {num_cells})")

        return {"status": "success", "saved": saved_files}

    except Exception as e:
        return {"status": "error", "message": str(e), "traceback": traceback.format_exc()}

def process_directory(dir_path):
    print(f"\n[START] Scanning directory: {dir_path}")
    if not os.path.exists(dir_path):
        print(f"[ABORT] Invalid path")
        return

    files = [f for f in os.listdir(dir_path) if f.lower().endswith('.med') and 'resu' not in f.lower()]
    print(f"[FOUND] {len(files)} mesh files.\n")

    for f_name in files:
        full_path = os.path.join(dir_path, f_name)
        print(f"[PROCESS] {f_name}...")
        
        result = extract_and_save_mesh(full_path, dir_path)
        
        if result["status"] == "error":
            print(f"[ERROR] {f_name}: {result['message']}")

if __name__ == "__main__":
    # Caminho Padrão ou Argumento
    if len(sys.argv) > 1:
        target = sys.argv[1]
        if os.path.isfile(target):
            extract_and_save_mesh(target, os.path.dirname(target))
        else:
            process_directory(target)
    else:
        # Default Hibrido
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        target_dir = os.path.join(base_dir, "testcases", "hibrido")
        process_directory(target_dir)
        
    print("\n[FINISH] Processing completed.")