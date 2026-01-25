"""
Section Mesh Service
Provides 2D mesh data from sectionproperties for 3D extrusion.
Separated from other services to maintain clean logic.
"""
from sectionproperties.pre.library import (
    rectangular_section,
    rectangular_hollow_section,
    circular_section,
    circular_hollow_section,
    mono_i_section
)
import numpy as np

def get_section_mesh(section_type: str, params: dict) -> dict:
    """
    Generate a 2D mesh of the section using sectionproperties.
    
    Args:
        section_type: RECTANGLE, BOX, CIRCLE, TUBE, I_SECTION
        params: Dictionary with hy, hz, thickness, rotation, offset_y, offset_z, etc.
        
    Returns:
        Dictionary with 'vertices' (Nx2) and 'triangles' (Mx3)
    """
    try:
        # Parse parameters
        p = {k: float(v) for k, v in params.items() if v}
        
        # Position parameters
        off_y = p.get('offset_y', 0.0)
        off_z = p.get('offset_z', 0.0)
        rotation = p.get('rotation', 0.0)
        
        geometry = None
        mesh_size = 10.0
        
        # Create base geometry
        if section_type == 'RECTANGLE':
            d, b = p.get('hy', 100), p.get('hz', 50)
            geometry = rectangular_section(d=d, b=b)
            mesh_size = min(d, b) / 5.0
            
        elif section_type == 'BOX':
            d, b, t = p.get('hy', 100), p.get('hz', 50), p.get('t', 5)
            geometry = rectangular_hollow_section(d=d, b=b, t=t, r_out=0, n_r=1)
            mesh_size = t / 1.5
            
        elif section_type == 'CIRCLE':
            d = 2 * p.get('r', 50)
            geometry = circular_section(d=d, n=32) # Lower n for visualization
            mesh_size = d / 8.0
            
        elif section_type == 'TUBE':
            d, t = 2 * p.get('r', 50), p.get('t', 5)
            geometry = circular_hollow_section(d=d, t=t, n=32)
            mesh_size = t / 1.5
            
        elif section_type == 'I_SECTION':
            h = p.get('h', 200)
            bf_t, bf_b = p.get('bf_top', 100), p.get('bf_bot', 100)
            tf_t, tf_b, tw = p.get('tf_top', 10), p.get('tf_bot', 10), p.get('tw', 6)
            geometry = mono_i_section(
                d=h, b_t=bf_t, b_b=bf_b, 
                t_ft=tf_t, t_fb=tf_b, t_w=tw, 
                r=p.get('r', 0), n_r=8
            )
            mesh_size = min(tw, tf_t, tf_b) / 1.5
            
        if not geometry:
            return {"status": "error", "message": f"Unsupported section type: {section_type}"}
            
        # Geometric Transformation (Normalization -> Rotation -> Shift)
        geometry = geometry.align_center(align_to=(0, 0))
        if abs(rotation) > 1e-9:
            geometry = geometry.rotate_section(angle=rotation, rot_point=(0, 0))
        if abs(off_y) > 1e-9 or abs(off_z) > 1e-9:
            geometry = geometry.shift_section(x_offset=off_z, y_offset=off_y)
            
        # Create mesh (Force linear order=1 to get T3 triangles for simpler extrusion)
        mesh_size = max(mesh_size, 2.0)
        geometry.create_mesh(mesh_sizes=[mesh_size])
        
        # Extract mesh data
        mesh_data = geometry.mesh
        vertices = mesh_data.get('vertices')
        triangles = mesh_data.get('triangles')
        
        # If triangles are quadratic (6 nodes), take only the first 3 (corners)
        if triangles is not None and len(triangles) > 0 and len(triangles[0]) == 6:
            triangles = triangles[:, :3]
            
        return {
            "status": "success",
            "vertices": vertices.tolist() if vertices is not None else [],
            "triangles": triangles.tolist() if triangles is not None else []
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}
