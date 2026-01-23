def build_pesanteur(config, model_name="MODELE", result_name="CHARGE_PES"):
    """
    Constrói a estrutura para uma lista de cargas de PESANTEUR em AFFE_CHAR_MECA.
    Retorna uma lista de configurações, uma para cada comando.
    """
    pes_list = config.get("pesanteur", [])
    if not isinstance(pes_list, list):
        # Fallback para o formato antigo se necessário (embora o novo JSON envie lista)
        if isinstance(pes_list, dict) and pes_list:
            pes_list = [pes_list]
        else:
            return []

    commands = []
    for item in pes_list:
        final_name = item.get("name", result_name)
        commands.append({
            "result_name": final_name,
            "model_name": model_name,
            "gravite": item.get("gravite", 9.81),
            "direction": tuple(item.get("direction", [0.0, 0.0, -1.0])),
            "group_ma": item.get("group_ma", None),
            "double_lagrange": "OUI",
            "info": 1,
            "veri_affe": "OUI",
            "veri_norm": "OUI"
        })

    return commands
