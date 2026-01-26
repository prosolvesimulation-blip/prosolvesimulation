def build_geometry(geometry_list, model_name="MODELE", result_name="CARA_ELEM"):
    """
    Unified builder for GEOMETRY.
    Processes Shells, Beams, and Volumes.
    Returns data for model assignment and element characteristics.
    """
    model_items = []
    cara_items = []

    for item in geometry_list:
        group = item["group"]
        element_type = item.get("type", "Solid").upper()
        
        # Skip Node groups for AFFE_MODELE assignment
        if element_type == "NODE" or item.get("_category") == "Node":
            continue

        # Determine type: use explicit section_type if available (New Frontend), else guess from type (Legacy)
        section_type = item.get("section_type", "").upper()
        # Fallback for legacy data or inferred types
        if not section_type:
            if element_type in ["SHELL", "DKT", "DST", "COQUE"]:
                section_type = "SHELL"
            elif element_type in ["BEAM", "POUTRE", "BARRE"]:
                section_type = "BEAM" # or RECTANGLE default?
            else:
                section_type = "SOLID"

        params = item.get("section_params", {})

        if section_type == "SHELL":
            # Model assignment
            model_items.append({
                "group": group,
                "modelisation": item.get("formulation", "DKT").upper()
            })
            # Cara assignment
            thickness = params.get("thickness") if params.get("thickness") is not None else item.get("thickness", 1.0)
            offset = params.get("offset") if params.get("offset") is not None else item.get("offset", 0.0)
            vx = params.get("vx") if params.get("vx") is not None else item.get("vx", 1.0)
            vy = params.get("vy") if params.get("vy") is not None else item.get("vy", 0.0)
            vz = params.get("vz") if params.get("vz") is not None else item.get("vz", 0.0)

            cara_items.append({
                "type": "COQUE",
                "group": group,
                "epais": thickness,
                "excentrement": offset,
                "vecteur": f"({vx}, {vy}, {vz})"
            })

        elif section_type in ["I_SECTION", "RECTANGLE", "BOX", "CIRCLE", "TUBE", "BEAM"]:
            # Model assignment
            model_items.append({
                "group": group,
                "modelisation": "POU_D_T"
            })
            
            # Cara assignment
            props = item.get("section_properties")
            if props:
                # 1. ADVANCED MAPPING: SectionProperties (SP) -> Code_Aster (CA)
                # CA local Y corresponds to SP Y (vertical in SP viewport)
                # CA local Z corresponds to SP X (horizontal in SP viewport)
                
                area = props.get("Area (A)", 1.0)
                # Use Nodal Inertias (already includes Steiner offset to 0,0)
                iy = props.get("Iyy (Node 0,0)", 1.0) # Moment about Node Y (SP Y)
                iz = props.get("Izz (Node 0,0)", 1.0) # Moment about Node Z (SP X)
                jx = props.get("Torsion J", 1.0)
                jg = props.get("Warping Iw", 0.0)
                
                # Shear coefficients: CA Ay = A / CA Ay'
                # CA Ay' (along local Y) = SP asy (along SP Y) -> recorded as "Shear Area Az" in calculator
                # CA Az' (along local Z) = SP asx (along SP X) -> recorded as "Shear Area Ay" in calculator
                as_y_ca = props.get("Shear Area Az", area)
                as_z_ca = props.get("Shear Area Ay", area)
                ay = area / as_y_ca if as_y_ca > 0 else 1.0
                az = area / as_z_ca if as_z_ca > 0 else 1.0
                
                # External fiber distances (RY, RZ) for stress calculation
                # Check for user-override from UI (fiber_y, fiber_z in section_params)
                f_y = float(params.get("fiber_y", 0) or 0)
                f_z = float(params.get("fiber_z", 0) or 0)
                
                if abs(f_y) > 1.0e-6 or abs(f_z) > 1.0e-6:
                    # User specified fiber coordinates - use them directly
                    ry = abs(f_y)
                    rz = abs(f_z)
                else:
                    # Default: use extreme fibers from section properties
                    ry = max(abs(props.get("Min Y", 0.0)), abs(props.get("Max Y", 0.0)))
                    rz = max(abs(props.get("Min X", 0.0)), abs(props.get("Max X", 0.0)))
                
                # Set minimum to avoid division by zero
                ry = max(ry, 1.0e-3)
                rz = max(rz, 1.0e-3)

                aster_section = "GENERALE"
                # Removed EY/EZ: properties already provided at the Node (Point of Interest)
                cara = "('A', 'IY', 'IZ', 'AY', 'AZ', 'JX', 'JG', 'RY', 'RZ')"
                vale = f"({area}, {iy}, {iz}, {ay}, {az}, {jx}, {jg}, {ry}, {rz})"
            
            else:
                # 2. LEGACY DATA / FALLBACK
                def get_p(k, default):
                    return params.get(k) if params.get(k) is not None else item.get(k, default)

                if section_type == "CIRCLE" or section_type == "TUBE":
                    aster_section = "CERCLE"
                    r = get_p("r", 50.0)
                    cara = "('R')"
                    vale = f"({r})"
                else:
                    aster_section = "RECTANGLE"
                    hy = get_p("hy", 100.0)
                    hz = get_p("hz", 50.0)
                    cara = "('HY', 'HZ')"
                    vale = f"({hy}, {hz})"
            
            cara_items.append({
                "type": "POUTRE",
                "group": group,
                "section": aster_section,
                "cara": cara,
                "vale": vale
            })

        else: # SOLID / VOLUME
            model_items.append({
                "group": group,
                "modelisation": "3D"
            })

    return {
        "model_items": model_items,
        "cara_items": cara_items,
        "model_result_name": model_name,
        "cara_result_name": result_name
    }
