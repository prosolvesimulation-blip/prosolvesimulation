def build_load_cases(lc_list, meca_config, pes_data, ddl_data, model_name="MODELE", reaction_extraction_data=None, **kwargs):
    """
    Constrói a lista de configurações de Load Cases (MECA_STATIQUE).
    """
    # Lista de NOMES válidos gerados pelos builds anteriores
    # ddl_data e pes_data são agora listas de configurações (cada uma tem 'name' ou 'result_name')
    valid_names = [d["name"] for d in ddl_data]
    
    if isinstance(pes_data, list):
        for p in pes_data:
            if "result_name" in p:
                valid_names.append(p["result_name"])
    elif pes_data and "result_name" in pes_data:
        # Fallback para objeto único
        valid_names.append(pes_data["result_name"])
    
    foc_data = kwargs.get("foc_data")
    if foc_data and "result_name" in foc_data:
        valid_names.append(foc_data["result_name"])

    nod_data = kwargs.get("nod_data")
    if nod_data and "result_name" in nod_data:
        valid_names.append(nod_data["result_name"])

    meca_runs = []
    
    if not lc_list:
        # Fallback se não houver LC, tenta usar o primeiro DDL disponível ou avisa
        default_load = valid_names[0] if valid_names else "CHARGE_DDL"
        lc_list = [{"name": "MECA", "loads": [default_load]}]

    base_config = meca_config.get("meca_statique", {})

    for lc in lc_list:
        case_name = lc.get("name", "CASE")
        result_name = f"RESU_{case_name}"
        
        excit_list_lc = []
        for load_name in lc.get("loads", []):
            # Validação: se o nome existe nos loads gerados
            if load_name in valid_names:
                excit_list_lc.append({
                    "charge": load_name,
                    "type_charge": "FIXE_CSTE"
                })

        # Prepara dados para o template load_cases.j2
        meca_runs.append({
            "case_name": case_name,
            "result_name": result_name,
            "cara_elem": base_config.get("cara_elem", "CARA_ELEM"),
            "cham_mater": base_config.get("cham_mater", "CHAM_MATER"),
            "modele": model_name,
            "excit_list": excit_list_lc,
            "option": base_config.get("option", "SIEF_ELGA"),
            "solveur": base_config.get("solveur", {}),
            "info": base_config.get("info", 1),
            "reaction_extraction": reaction_extraction_data
        })

    return {
        "runs": meca_runs
    }
