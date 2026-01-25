import sys
try:
    import medcoupling as mc
    
    print("=" * 80)
    print("TESTING NATIVE MESH MERGING")
    print("=" * 80)
    
    # Create two disjoint meshes
    c1 = mc.DataArrayDouble([0,0,0, 1,0,0, 0,1,0], 3, 3)
    m1 = mc.MEDCouplingUMesh("M1", 2)
    m1.setCoords(c1)
    m1.allocateCells(1)
    m1.insertNextCell(mc.NORM_TRI3, [0, 1, 2])
    
    c2 = mc.DataArrayDouble([10,0,0, 11,0,0, 10,1,0], 3, 3)
    m2 = mc.MEDCouplingUMesh("M2", 2)
    m2.setCoords(c2)
    m2.allocateCells(1)
    m2.insertNextCell(mc.NORM_TRI3, [0, 1, 2])
    
    print("Merging M1 and M2 using native static method MergeUMeshes...")
    try:
        # MergeUMeshes is a static method that takes a list of meshes
        merged = mc.MEDCouplingUMesh.MergeUMeshes([m1, m2])
        print(f"Merged nodes: {merged.getNumberOfNodes()} (Expected: 6)")
        print(f"Merged cells: {merged.getNumberOfCells()} (Expected: 2)")
        print(f"Sample coord of merged: {merged.getCoords().getTuple(3)}")
    except Exception as e:
        print(f"MergeUMeshes failed: {e}")

except Exception as e:
    import traceback
    traceback.print_exc()
