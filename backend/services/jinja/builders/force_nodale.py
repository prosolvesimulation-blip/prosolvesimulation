def build_force_nodale(force_nodale_list, model_name="MODELE", result_name="CHARGE_NOD"):
    """
    Constrói a configuração para FORCE_NODALE (Cargas Pontuais).
    """
    if not force_nodale_list:
        return {}

    items = []
    for item in force_nodale_list:
        if item.get("type") == "FORCE_NODALE":
            # Extrai componentes de força
            fz = item.get("fz", 0)
            fx = item.get("fx", 0)
            fy = item.get("fy", 0)
            group = item.get("group")
            
            if group and (float(fx) != 0 or float(fy) != 0 or float(fz) != 0):
                cmd = {
                    "GROUP_MA": group
                }
                if float(fx) != 0: cmd["FX"] = fx
                if float(fy) != 0: cmd["FY"] = fy
                if float(fz) != 0: cmd["FZ"] = fz
                
                items.append(cmd)

    if not items:
        return {}

    return {
        "result_name": result_name,
        "modele": model_name,
        "items": items
    }
