"""
Section Calculator Service - sectionproperties Integration
Migrated from main.pyw lines 389-589
CRITICAL: Preserves exact offset/rotation logic
"""
import io
import base64
from sectionproperties.pre.library import (
    rectangular_section,
    rectangular_hollow_section,
    circular_section,
    circular_hollow_section,
    mono_i_section
)
from sectionproperties.analysis import Section
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt


def calculate_section_properties(section_type: str, params: dict) -> dict:
    """
    Calculate section properties using sectionproperties library.
    
    CRITICAL 3-STEP TRANSFORM:
    1. RESET: align_center(0,0) - Normalize centroid
    2. ROTATE: rotate_section(angle, rot_point=(0,0)) - Rotate around centroid
    3. SHIFT: shift_section(x_offset=off_z, y_offset=off_y) - Move to final position
    
    Args:
        section_type: Type of section (RECTANGLE, BOX, CIRCLE, TUBE, I_SECTION)
        params: Dictionary of section parameters
        
    Returns:
        Dictionary with 'properties' and 'image' (base64)
    """
    try:
        # 1. PARSE PARAMETERS
        p = {k: float(v) for k, v in params.items() if v}
        
        # Position parameters (CRITICAL!)
        off_y = p.get('offset_y', 0.0)
        off_z = p.get('offset_z', 0.0)
        rotation = p.get('rotation', 0.0)  # Degrees
        
        geometry = None
        mesh_size = 10.0
        
        # 2. CREATE BASE GEOMETRY
        if section_type == 'RECTANGLE':
            d, b = p.get('hy', 100), p.get('hz', 50)
            geometry = rectangular_section(d=d, b=b)
            mesh_size = min(d, b) / 5.0
            
        elif section_type == 'BOX':
            d, b, t = p.get('hy', 100), p.get('hz', 50), p.get('t', 5)
            if t*2 >= d or t*2 >= b:
                t = min(d, b)/2 - 0.1
            geometry = rectangular_hollow_section(d=d, b=b, t=t, r_out=0, n_r=1)
            mesh_size = t / 1.5
            
        elif section_type == 'CIRCLE':
            d = 2 * p.get('r', 50)
            geometry = circular_section(d=d, n=64)
            mesh_size = d / 10.0
            
        elif section_type == 'TUBE':
            d, t = 2 * p.get('r', 50), p.get('t', 5)
            if t*2 >= d:
                t = d/2 - 0.1
            geometry = circular_hollow_section(d=d, t=t, n=64)
            mesh_size = t / 1.5
            
        elif section_type == 'I_SECTION':
            h = p.get('h', 200)
            bf_t, bf_b = p.get('bf_top', 100), p.get('bf_bot', 100)
            tf_t, tf_b, tw = p.get('tf_top', 10), p.get('tf_bot', 10), p.get('tw', 6)
            if tw >= bf_t:
                tw = bf_t - 2
            if (tf_t + tf_b) >= h:
                h = tf_t + tf_b + 10
            geometry = mono_i_section(
                d=h, b_t=bf_t, b_b=bf_b, 
                t_ft=tf_t, t_fb=tf_b, t_w=tw, 
                r=p.get('r', 0), n_r=8
            )
            mesh_size = min(tw, tf_t, tf_b) / 1.5
        
        if not geometry:
            raise ValueError(f"Unknown section type: {section_type}")
        
        # 3. GEOMETRIC MANIPULATION (3-STEP CRITICAL FLOW)
        
        # STEP A: RESET (Normalization)
        # Centroid goes to (0,0)
        geometry = geometry.align_center(align_to=(0, 0))
        
        # STEP B: ROTATION (Local)
        # Rotate around centroid (now at 0,0)
        if abs(rotation) > 1e-9:
            # rot_point=(0,0) ensures rotation around own axis
            geometry = geometry.rotate_section(angle=rotation, rot_point=(0, 0))
        
        # STEP C: SHIFT (Global Positioning)
        # Move from (0,0) to final offset
        if abs(off_y) > 1e-9 or abs(off_z) > 1e-9:
            geometry = geometry.shift_section(x_offset=off_z, y_offset=off_y)
        
        # 4. MESH AND CALCULATION
        # Mesh is created at final position (rotated and shifted)
        mesh_size = max(mesh_size, 2.0)
        geometry.create_mesh(mesh_sizes=[mesh_size])
        
        sec = Section(geometry)
        
        # Execute FEM integrals
        sec.calculate_geometric_properties()
        sec.calculate_warping_properties()
        sec.calculate_plastic_properties()
        
        # 5. DIRECT EXTRACTION (GLOBAL ATTRIBUTES)
        # Since mesh is at final position, global integral IS nodal property (Steiner included)
        
        area = sec.section_props.area
        (cx, cy) = sec.get_c()  # Final centroid
        
        # Local inertias (Centroidal - already reflect piece rotation!)
        (ixx_c, iyy_c, ixy_c) = sec.get_ic()
        
        # Nodal inertias (Global at 0,0)
        ixx_frame = sec.section_props.ixx_g
        iyy_frame = sec.section_props.iyy_g
        ixy_frame = sec.section_props.ixy_g
        
        qx_frame = sec.section_props.qx
        qy_frame = sec.section_props.qy
        
        # Others
        try:
            (i1, i2) = sec.get_ip()
            theta = sec.get_phi()
        except:
            (i1, i2, theta) = sec.get_ip()
            
        (rx, ry) = sec.get_rc()
        j = sec.get_j()
        gamma = sec.get_gamma()
        (asx, asy) = sec.get_as()
        
        z_vals = sec.get_z()
        if len(z_vals) == 4:
            zxx_eff = min(z_vals[0], z_vals[1])
            zyy_eff = min(z_vals[2], z_vals[3])
        else:
            zxx_eff, zyy_eff = z_vals[:2]
        
        s_vals = sec.get_s()
        sxx, syy = s_vals[:2]
        
        # 6. CALCULATE EXTENTS AND PREPARE PROPERTIES
        (xmin, xmax, ymin, ymax) = geometry.calculate_extents()
        
        props = {
            "Area (A)": area,
            "Centroid Y (cy)": cy,
            "Centroid Z (cx)": cx,
            "Static Moment Qy (at 0,0)": qx_frame,
            "Static Moment Qz (at 0,0)": qy_frame,
            
            # Local (Relative to rotated piece centroid)
            "Iyy (Local)": iyy_c,
            "Izz (Local)": ixx_c,
            "Iyz (Local)": ixy_c,
            "I1 (Principal)": i1,
            "I2 (Principal)": i2,
            "Angle (deg)": theta,
            
            # Nodal (Absolute reference 0,0)
            "Iyy (Node 0,0)": iyy_frame,
            "Izz (Node 0,0)": ixx_frame,
            "Iyz (Node 0,0)": ixy_frame,
            
            "Torsion J": j,
            "Warping Iw": gamma,
            "Shear Area Ay": asx,
            "Shear Area Az": asy,
            
            "Elastic Mod. Wy (Zxx)": zxx_eff,
            "Elastic Mod. Wz (Zyy)": zyy_eff,
            "Plastic Mod. Zy (Sxx)": sxx,
            "Plastic Mod. Zz (Syy)": syy,
            
            "Radius Gyration ry": ry,
            "Radius Gyration rz": rx,
 
            # Extents (Relative to Node 0,0)
            "Min Y": ymin,
            "Max Y": ymax,
            "Min X": xmin,
            "Max X": xmax,
        }
        
        # 7. GENERATE IMAGE
        plt.style.use('default')
        fig, ax = plt.subplots(figsize=(6, 6))
        
        geometry.plot_geometry(ax=ax, cp=False, legend=False, title='')
        
        fig.patch.set_facecolor('white')
        ax.set_facecolor('white')
        ax.axis('on')
        ax.grid(True, color='#e2e8f0', linestyle='--', linewidth=0.5)
        ax.set_aspect('equal', adjustable='box')
        
        ax.plot(cx, cy, 'r+', markersize=15, markeredgewidth=2, label='Centroid')
        ax.plot(0, 0, 'bx', markersize=12, markeredgewidth=2, label='Node (0,0)')
        
        if abs(cx) > 1e-4 or abs(cy) > 1e-4:
            ax.plot([0, cx], [0, cy], color='red', linestyle=':', linewidth=1.5, label='Offset')
        
        ax.axhline(y=cy, color='#94a3b8', linestyle='-.', linewidth=1)
        ax.axvline(x=cx, color='#94a3b8', linestyle='-.', linewidth=1)
        ax.axhline(y=0, color='black', linestyle='-', linewidth=0.8, alpha=0.3)
        ax.axvline(x=0, color='black', linestyle='-', linewidth=0.8, alpha=0.3)
        
        x_data = [0, cx, xmin, xmax]
        y_data = [0, cy, ymin, ymax]
        margin = max(xmax-xmin, ymax-ymin) * 0.2
        if margin == 0:
            margin = 10
        ax.set_xlim(min(x_data)-margin, max(x_data)+margin)
        ax.set_ylim(min(y_data)-margin, max(y_data)+margin)
        
        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0.05, dpi=120)
        buf.seek(0)
        img_str = base64.b64encode(buf.read()).decode('utf-8')
        plt.close(fig)
        
        # 8. EXTRACT MESH DATA
        try:
            sp_mesh = geometry.mesh
            vertices = sp_mesh.get('vertices')
            triangles = sp_mesh.get('triangles')
            # Handle quadratic triangles (6 nodes) -> Linear (3 nodes)
            if triangles is not None and len(triangles) > 0 and len(triangles[0]) == 6:
                triangles = triangles[:, :3]
            
            mesh_data = {
                "vertices": vertices.tolist() if vertices is not None else [],
                "triangles": triangles.tolist() if triangles is not None else []
            }
        except:
            mesh_data = None
        
        return {
            "status": "success",
            "properties": props,
            "mesh": mesh_data,
            "image": f"data:image/png;base64,{img_str}"
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise Exception(f"Section calculation error: {str(e)}")
