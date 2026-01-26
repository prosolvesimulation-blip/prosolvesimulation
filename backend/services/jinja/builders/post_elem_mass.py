def build_post_elem_mass(config, model_name="MODELE", field_mat_name="CHAM_MATER", cara_elem_name="CARA_ELEM"):
    """
    Builds data for POST_ELEM (MASS_INER) and IMPR_TABLE.
    """
    calculations = config.get("mass_calculations", [])
    
    # Professional Default: Always calculate global mass if not specified
    if not calculations:
        calculations = [{
            "result_name": "tab_mass",
            "title": "Global_Model_Mass",
            "export_title": "MASS_PROPERTIES"
        }]
    
    commands = []
    for item in calculations:
        commands.append({
            "result_name": item.get("result_name", "tab_mass"),
            "model_name": model_name,
            "field_mat_name": field_mat_name,
            "cara_elem_name": cara_elem_name,
            "title": item.get("title", "Physical_Mass_Structure"),
            "unit": item.get("unit", 26),
            "format": item.get("format", "TABLEAU"),
            "separator": item.get("separator", ","),
            "export_title": item.get("export_title", "MASS")
        })
        
    return commands
