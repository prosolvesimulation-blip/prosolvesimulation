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
            "phenomene": "MECANIQUE" # Padrão, mas poderia vir do JSON
        }
        items.append(item)

    return {
        "result_name": result_name,
        "mesh_name": mesh_name,
        "items": items
    }