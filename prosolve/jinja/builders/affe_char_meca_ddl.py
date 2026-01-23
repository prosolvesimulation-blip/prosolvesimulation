def build_affe_char_meca_ddl(ddl_list, model_name="MODELE", result_name="CHARGE_DDL"):
    """
    Constrói a estrutura para AFFE_CHAR_MECA focada EXCLUSIVAMENTE em DDL_IMPO.
    Retorna uma lista de dicionários, um para cada comando individual.
    """
    commands = []
    order_keys = ["DRX", "DRY", "DRZ", "DX", "DY", "DZ"]

    for item in ddl_list:
        name = item.get("name", result_name)
        input_params = item.get("params", {})
        
        active_params = []
        for key in order_keys:
            if key in input_params:
                active_params.append((key, input_params[key]))

        commands.append({
            "name": name,
            "group": item["group"],
            "params": active_params,
            "model_name": model_name,
            "double_lagrange": "OUI",
            "info": 1,
            "veri_affe": "OUI",
            "veri_norm": "OUI"
        })

    return commands