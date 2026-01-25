import sys
try:
    import medcoupling as mc
    
    print("=" * 80)
    print("INSPECTING extrudeConnectivity")
    print("=" * 80)
    
    # Check if it's a static method on MEDCouplingUMesh or something else
    try:
        print(mc.MEDCouplingUMesh.extrudeConnectivity.__doc__)
    except:
        print("extrudeConnectivity not in MEDCouplingUMesh")
        
    print("\n" + "=" * 80)
    print("INSPECTING computeSkin")
    print("=" * 80)
    try:
        print(mc.MEDCouplingUMesh.computeSkin.__doc__)
    except:
        print("computeSkin not in MEDCouplingUMesh")

except Exception as e:
    import traceback
    traceback.print_exc()
