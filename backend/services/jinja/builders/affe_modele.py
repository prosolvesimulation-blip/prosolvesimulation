def build_affe_modele(models_list, mesh_name="MAIL", result_name="MODELE"):
    """
    Prepara os dados para o comando AFFE_MODELE.
    """
    items = []
    
    for model in models_list:
        # Aqui você pode adicionar lógica extra, validações, etc.
        item = {
            "group": model["group"],
            "modelisation": model["type"],
            "phenomene": model.get("phenomenon", "MECANIQUE") # Use physics from frontend, default to MECANIQUE
        }
        items.append(item)

    return {
        "result_name": result_name,
        "mesh_name": mesh_name,
        "items": items
    }