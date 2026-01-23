def build_affe_materiau(assignments_list, model_name="MODELE", result_name="CHMAT"):
    """
    Constrói a estrutura para AFFE_MATERIAU baseada em um JSON de atribuições.
    assignments_list: Lista de dicts { "material": "NOME", "groups": [...] }
    """
    items = []

    for item in assignments_list:
        raw_mat_name = item["material"]
        groups = item.get("groups", [])
        
        if not groups:
            continue
            
        # Reconstrói o nome da variável igual ao DEFI (ex: ACIER -> M_ACIER)
        # Importante: A regra de nomeação deve ser idêntica ao builder do DEFI
        safe_name = raw_mat_name.upper().replace(" ", "_")
        var_name = f"M_{safe_name}"

        items.append({
            "mater": var_name,
            "groups": groups
        })

    return {
        "result_name": result_name,
        "model_name": model_name,
        "items": items
    }