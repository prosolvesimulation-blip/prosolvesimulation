def build_force_coque(config, model_name="MODELE"):
    """
    Constrói dados para FORCE_COQUE com normalização de área.
    """
    foc_list = config.get("force_coque", [])
    if not foc_list:
        return {}, {} # Sem dados

    # 1. Configuração para o loop de cálculo de área (Python puro dentro do .comm)
    # Lista de tuplas: (nome, group_ma, total_force)
    press_config = []
    
    # 2. Configuração para o comando AFFE_CHAR_MECA
    # Lista de items de carga
    load_items = []

    for item in foc_list:
        name = item["name"]
        group = item["group"]
        force = item["total_force"]
        direction = item.get("direction", "PRES") # Default PRES, or FX, FY, FZ...

        # Adiciona à lista de cálculo
        press_config.append( (name, group, force) )

        # Constrói o item de carga que vai usar o valor calculado
        # O valor calculado estará em press_lookup[name][1]
        # Sintaxe JINJA vai inserir isso
        load_items.append({
            "name": name,
            "group": group,
            "direction": direction,
            # Placeholder para o template saber que deve pegar do dict
            "lookup_key": name 
        })

    calc_data = {
        "model_name": model_name,
        "press_config": press_config,
        # Precisamos de uma lista de TODOS os grupos envolvidos para criar o campo dummy corretamente?
        # O script original usa 'all_groups_ma'. Vamos passar a lista de grupos usados aqui.
        "groups": list(set([item["group"] for item in foc_list]))
    }

    load_data = {
        "model_name": model_name,
        "result_name": "CHARGE_FOC",
        "load_items": load_items,
        "double_lagrange": "OUI",
        "info": 1,
        "veri_affe": "OUI"
    }

    return calc_data, load_data
