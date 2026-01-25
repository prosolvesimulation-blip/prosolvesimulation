import sys
import os
import json

try:
    import MEDLoader as ml
    import medcoupling as mc
except ImportError:
    print("MEDCOUPLING not found")
    sys.exit(1)

def explore(file_path):
    print(f"Checking {file_path}")
    mesh_names = ml.GetMeshNames(file_path)
    mesh_name = mesh_names[0]
    
    # Read just the shell group
    group_mesh = ml.ReadUMeshFromGroups(file_path, mesh_name, 0, ["12mm"])
    
    print(f"Mesh Dim: {group_mesh.getMeshDimension()}")
    print(f"Space Dim: {group_mesh.getSpaceDimension()}")
    
    # Look for normal/orthogonal computation methods
    methods = dir(group_mesh)
    relevant = [m for m in methods if 'Normal' in m or 'Orthogonal' in m or 'Measure' in m]
    print(f"Relevant Methods: {relevant}")
    
    # Try to compute normals
    try:
        # buildOrthogonalField is a common one
        if hasattr(group_mesh, 'buildOrthogonalField'):
            print("Trying buildOrthogonalField()...")
            normals = group_mesh.buildOrthogonalField()
            print(f"Result type: {type(normals)}")
            print(f"Number of tuples: {normals.getNumberOfTuples()}")
            print(f"Number of components: {normals.getNumberOfComponents()}")
            
            # Print sample
            arr = normals.toNumPyArray()
            print(f"Sample normal (0): {arr[0]}")
    except Exception as e:
        print(f"Error computing normals: {e}")

explore(r"c:\Users\jorge\OneDrive\ProSolveSimulation\test01\shell.med")
