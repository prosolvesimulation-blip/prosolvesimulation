def build_defi_materiau(materials_list):
    """
    Prepara os dados para o comando DEFI_MATERIAU.
    Retorna uma lista de dicionários contendo var_name, E, NU e RHO.
    """
    definitions = []

    for mat in materials_list:
        # Sanitização do nome para criar variável no Code_Aster
        # Ex: "Concrete C30" -> "M_CONCRETE_C30"
        clean_name = mat["name"].upper().replace(" ", "_")
        var_name = f"M_{clean_name}"

        props = mat # The unified config is flat
        
        definitions.append({
            "var_name": var_name,
            "E": props.get("E"),
            "NU": props.get("nu") or props.get("NU"),
            "RHO": props.get("rho") or props.get("RHO")
        })

    return definitions