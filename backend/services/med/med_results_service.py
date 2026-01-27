#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MED Results Service - Extraction of DEPL, SIGM and Von Mises Calculation.
Designed for 100% In-Memory consumption via Stdout Pipe.
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
    np = None

try:
    import vtk
    from vtk.util import numpy_support
except ImportError:
    vtk = None

def generate_vectors(points, field_data, nb_comp):
    """
    Simulates ParaView's 'Generate Vectors' using VTK backend.
    Converts multi-component array to a proper 3D Vector field.
    """
    if vtk is None: return field_data
    
    try:
        # 1. Create VTK PolyData stub
        pd = vtk.vtkPolyData()
        pts = vtk.vtkPoints()
        pts.SetData(numpy_support.numpy_to_vtk(np.array(points).reshape(-1, 3)))
        pd.SetPoints(pts)
        
        # 2. Add raw displacement array
        raw_arr = numpy_support.numpy_to_vtk(np.array(field_data).reshape(-1, nb_comp))
        raw_arr.SetName("DISPLACEMENT_RAW")
        pd.GetPointData().AddArray(raw_arr)
        
        # 3. Use vtkArrayCalculator to 'Generate Vectors' (DX, DY, DZ)
        calc = vtk.vtkArrayCalculator()
        calc.SetInputData(pd)
        calc.AddScalarVariable("dx", "DISPLACEMENT_RAW", 0)
        calc.AddScalarVariable("dy", "DISPLACEMENT_RAW", 1)
        calc.AddScalarVariable("dz", "DISPLACEMENT_RAW", 2)
        calc.SetFunction("dx*iHat + dy*jHat + dz*kHat")
        calc.SetResultArrayName("DISPLACEMENT_VEC")
        calc.Update()
        
        # 4. Extract Result
        res_pd = calc.GetOutput()
        vec_arr = res_pd.GetPointData().GetArray("DISPLACEMENT_VEC")
        return numpy_support.vtk_to_numpy(vec_arr).flatten().tolist()
    except Exception as e:
        # Silently log to stderr
        sys.stderr.write(f"Generate Vectors failed: {e}\n")
        return field_data

def get_field_meta(file_path):
    """Lists available fields and their order/time steps."""
    if not ml: return {"status": "error", "message": "MEDCoupling not available"}
    
    try:
        mesh_names = ml.GetMeshNames(file_path)
        mesh_name = mesh_names[0] if mesh_names else "00000001"
        field_names = ml.GetAllFieldNames(file_path)
        
        meta = {}
        for fn in field_names:
            try:
                # Try discovery on nodes or cells (most Code_Aster results are here)
                ts = []
                try:
                    ts = ml.GetFieldIterations(ml.ON_NODES, file_path, mesh_name, fn)
                except:
                    ts = ml.GetFieldIterations(ml.ON_CELLS, file_path, mesh_name, fn)
                meta[fn] = ts # List of [iteration, order]
            except:
                meta[fn] = []
        return {"status": "success", "fields": meta, "mesh_name": mesh_name}
    except Exception as e:
        return {"status": "error", "message": str(e), "traceback": traceback.format_exc()}

def extract_nodal_displacement(file_path, step_idx=0):
    """Extracts DEPL field and returns point deltas as a proper 3D vector."""
    try:
        mesh_names = ml.GetMeshNames(file_path)
        mesh_name = mesh_names[0] if mesh_names else "00000001"
        field_names = ml.GetAllFieldNames(file_path)
        depl_field = next((f for f in field_names if "DEPL" in f), None)
        
        if not depl_field:
            return {"status": "error", "message": "DEPL field not found"}
            
        # Get Geometry for vector context
        mesh_obj = ml.ReadUMeshFromFile(file_path, mesh_name, 0)
        coords = mesh_obj.getCoords().toNumPyArray().flatten().tolist()
        
        # Read Field
        f_depl = ml.ReadFieldNode(file_path, mesh_name, 0, depl_field, 1, 1)
        arr_obj = f_depl.getArray()
        nb_comp = arr_obj.getNumberOfComponents()
        raw_data = arr_obj.toNumPyArray().flatten().tolist()
        
        # VTK Vector Generation
        v_data = generate_vectors(coords, raw_data, nb_comp)
            
        return {"status": "success", "field_name": depl_field, "data": v_data}
    except Exception as e:
        return {"status": "error", "message": f"DEPL extraction failed: {e}"}

def calculate_von_mises(file_path, step_idx=0):
    """
    Extracts SIGM or VMIS field.
    """
    try:
        mesh_names = ml.GetMeshNames(file_path)
        mesh_name = mesh_names[0] if mesh_names else "00000001"
        field_names = ml.GetAllFieldNames(file_path)
        
        # Priority 1: VM_ (Already calculated by Code_Aster)
        vm_field = next((f for f in field_names if f.startswith("VM_")), None)
        
        if vm_field:
            # Code_Aster usually outputs VM at nodes (ReadFieldNode)
            try:
                f_vm = ml.ReadFieldNode(file_path, mesh_name, 0, vm_field, 1, 1)
            except:
                # If fail, try Cell
                f_vm = ml.ReadFieldCell(file_path, mesh_name, 0, vm_field, 1, 1)
                
            arr = f_vm.getArray().toNumPyArray()
            return {"status": "success", "field_name": vm_field, "data": arr.flatten().tolist()}
            
        # Priority 2: SIGM_ (Calculation needed)
        sigm_field = next((f for f in field_names if "SIGM" in f), None)
        if not sigm_field:
            return {"status": "error", "message": "No Stress field found"}

        try:
            f_sigm = ml.ReadFieldNode(file_path, mesh_name, 0, sigm_field, 1, 1)
        except:
            f_sigm = ml.ReadFieldCell(file_path, mesh_name, 0, sigm_field, 1, 1)
            
        arr = f_sigm.getArray().toNumPyArray() 
        
        if arr.shape[1] >= 6:
            s11, s22, s33 = arr[:, 0], arr[:, 1], arr[:, 2]
            s12, s13, s23 = arr[:, 3], arr[:, 4], arr[:, 5]
            vm = np.sqrt(0.5 * ((s11 - s22)**2 + (s22 - s33)**2 + (s33 - s11)**2 + 6.0 * (s12**2 + s23**2 + s13**2)))
            return {"status": "success", "field_name": sigm_field, "data": vm.tolist()}
        
        return {"status": "error", "message": f"Unsupported SIGM components: {arr.shape[1]}"}
        
    except Exception as e:
        return {"status": "error", "message": f"Von Mises failed: {e}"}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "No file path provided"}))
        sys.exit(1)
        
    target_med = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else "--meta"
    
    if mode == "--meta":
        res = get_field_meta(target_med)
    elif mode == "--depl":
        res = extract_nodal_displacement(target_med)
    elif mode == "--mises":
        res = calculate_von_mises(target_med)
    else:
        # Explicit Field Name (e.g., VM_SUP_LOAD_COMB_01)
        try:
            mesh_names = ml.GetMeshNames(target_med)
            mesh_name = mesh_names[0] if mesh_names else "00000001"
            
            # Auto-detect if it's Nodal or Cell
            f_obj = None
            try:
                f_obj = ml.ReadFieldNode(target_med, mesh_name, 0, mode, 1, 1)
            except:
                f_obj = ml.ReadFieldCell(target_med, mesh_name, 0, mode, 1, 1)
            
            if f_obj:
                arr_obj = f_obj.getArray()
                # SCALAR GENERATION: For VM_ fields, prioritize the first component as the heatmap scalar
                if mode.startswith("VM_") and arr_obj.getNumberOfComponents() > 1:
                    arr_obj = arr_obj.keepSelectedComponents([0])
                
                res = {"status": "success", "field_name": mode, "data": arr_obj.toNumPyArray().flatten().tolist()}
            else:
                res = {"status": "error", "message": f"Field {mode} not found"}
        except Exception as e:
            res = {"status": "error", "message": f"Failed to extract {mode}: {e}"}
        
    # Marker-based Stdout delivery
    sys.stdout.write("__JSON_START__")
    sys.stdout.write(json.dumps(res))
    sys.stdout.write("__JSON_END__")
