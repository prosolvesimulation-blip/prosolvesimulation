import sys
import os

try:
    from MEDLoader import GetMeshNames, GetMeshGroupsNames, ReadUMeshFromGroups
    import medcoupling as mc
    
    file_path = r"c:\Users\jorge\OneDrive\ProSolveSimulation\test01\beam.med"
    print(f"Testing with: {file_path}")
    
    mesh_names = GetMeshNames(file_path)
    print(f"Meshes: {mesh_names}")
    
    if mesh_names:
        mesh_name = mesh_names[0]
        groups = GetMeshGroupsNames(file_path, mesh_name)
        print(f"Groups: {groups}")
        
        for g in groups:
            # Read mesh subset for this group
            # ReadUMeshFromGroups(fileName, meshName, iteration=0, groupNames=[])
            mesh_group = ReadUMeshFromGroups(file_path, mesh_name, 0, [g])
            print(f"Group '{g}': {mesh_group.getNumberOfCells()} cells, Type: {mesh_group.getMeshDimension()}D")
            
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
