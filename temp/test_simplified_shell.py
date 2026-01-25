import sys
try:
    import medcoupling as mc
    
    print("=" * 80)
    print("TESTING SIMPLIFIED SHELL GENERATION")
    print("=" * 80)
    
    # Create surface mesh
    coords = mc.DataArrayDouble([0,0,0, 1,0,0, 0,1,0], 3, 3)
    surf = mc.MEDCouplingUMesh("Surf", 2)
    surf.setCoords(coords)
    surf.allocateCells(1)
    surf.insertNextCell(mc.NORM_TRI3, [0, 1, 2])
    
    # Method 1: The "2 command" way if there's a direct extrude
    print("\nTrying direct extrude if it exists...")
    # Checking for any 'extrude' that takes just distance
    if hasattr(surf, 'extrude'):
        print("extrude() exists!")
        # help(surf.extrude)
    
    # Method 2: What I was doing but cleaner
    print("\nSimulating path + extruded + boundary...")
    path_coords = mc.DataArrayDouble([0,0,-0.5, 0,0,0.5], 2, 3)
    path = mc.MEDCouplingUMesh("Path", 1)
    path.setCoords(path_coords)
    path.allocateCells(1)
    path.insertNextCell(mc.NORM_SEG2, [0, 1])
    
    vol = surf.buildExtrudedMesh(path, 0)
    skin = vol.buildBoundaryMesh(True)
    
    print(f"Skin cells: {skin.getNumberOfCells()}")
    print(f"Skin nodes: {skin.getNumberOfNodes()}")

    # Comparison: Is there a way to get the skin WITHOUT building the volume?
    # Maybe buildSkin?
    if hasattr(surf, 'computeSkin'):
        # computeSkin on 2D returns the boundary edges (1D)
        edge_skin = surf.computeSkin()
        print(f"computeSkin on 2D mesh returns dimension: {edge_skin.getMeshDimension()}")

except Exception as e:
    import traceback
    traceback.print_exc()
