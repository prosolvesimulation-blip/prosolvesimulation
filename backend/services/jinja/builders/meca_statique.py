def build_meca_statique(config, result_name="RESU"):
    """
    Constrói a estrutura para MECA_STATIQUE.
    """
    data = config.get("meca_statique", {})
    
    # Extrai listas e valores simples
    excit_list = data.get("excit", [])
    
    return {
        "result_name": result_name,
        "cara_elem": data.get("cara_elem"),
        "cham_mater": data.get("cham_mater"),
        "excit_list": excit_list,
        "modele": data.get("modele"),
        # Valores fixos/default conforme solicitação
        "info": 1,
        "inst": 0.0,
        "option": "SIEF_ELGA",
        "solveur": {
            "acceleration": "AUTO",
            "elim_lagr": "LAGR2",
            "gestion_memoire": "AUTO",
            "low_rank_seuil": 0.0,
            "matr_distribuee": "NON",
            "methode": "MUMPS",
            "nb_rhs": 1,
            "nprec": 8,
            "pcent_pivot": 35,
            "posttraitements": "AUTO",
            "pretraitements": "AUTO",
            "reduction_mpi": 0,
            "renum": "AUTO",
            "resi_rela": 1e-06,
            "stop_singulier": "OUI",
            "type_resol": "AUTO"
        }
    }
