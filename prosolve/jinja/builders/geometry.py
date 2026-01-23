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

        if element_type == "SHELL":
            # Model assignment
            model_items.append({
                "group": group,
                "modelisation": item.get("formulation", "DKT").upper()
            })
            # Cara assignment
            cara_items.append({
                "type": "COQUE",
                "group": group,
                "epais": item.get("thickness", 1.0),
                "excentrement": item.get("offset", 0.0),
                "vecteur": f"({item.get('vx', 1.0)}, {item.get('vy', 0.0)}, {item.get('vz', 0.0)})"
            })

        elif element_type == "BEAM":
            # Model assignment
            model_items.append({
                "group": group,
                "modelisation": "POU_D_T"
            })
            # Cara assignment
            section = item.get("section", "RECTANGLE").upper()
            if section == "RECTANGLE":
                hy = item.get("hy", 1.0)
                hz = item.get("hz", 1.0)
                cara = "('HY', 'HZ')"
                vale = f"({hy}, {hz})"
            else: # CIRCLE
                r = item.get("r", 1.0)
                cara = "('R')"
                vale = f"({r})"
                
            cara_items.append({
                "type": "POUTRE",
                "group": group,
                "section": section,
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
