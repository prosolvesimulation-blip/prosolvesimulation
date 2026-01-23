def build_affe_cara_elem_shell(shell_list, model_name="MODELE", result_name="CARA_ELEM"):
    """
    Constrói a estrutura para AFFE_CARA_ELEM focada apenas em COQUE (Cascas).
    """
    items = []

    for item in shell_list:
        group = item["group"]
        thickness = item["thickness"]
        excentricity = item.get("excentricity", 0.0)
        # Vetor padrão para cascas
        vector = tuple(item.get("vector", [1.0, 0.0, 0.0]))

        items.append({
            "group": group,
            "epais": thickness,
            "vecteur": vector,
            "excentrement": excentricity,
            
            # Constantes fixas para este tipo de análise
            "a_cis": 0.8333333,
            "coef_rigi_drz": 1e-05,
            "coque_ncou": 1,
            "iner_rota": "OUI",
            "modi_metrique": "NON"
        })

    return {
        "result_name": result_name,
        "model_name": model_name,
        "items": items
    }