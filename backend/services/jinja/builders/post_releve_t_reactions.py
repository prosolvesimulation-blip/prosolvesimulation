def build_post_releve_t_reactions(config, ddl_list):
    """
    Builds data for reaction extraction.
    Identifies which groups have constraints (from ddl_list).
    """
    reac_config = config.get("reaction_extraction", {})
    
    # Professional default: If there are constraints, we usually want reactions
    # unless explicitly disabled in the config.
    enabled = reac_config.get("enabled", True) 
    
    if not enabled:
        return None

    # Get unique groups from ddl_list
    constrained_groups = list(set([item["group"] for item in ddl_list if "group" in item]))

    # Fallback to 'TOUT_NO' if no specific groups but enabled
    if not constrained_groups and enabled:
        constrained_groups = ['TOUT_NO']
    
    if not constrained_groups:
        return None

    return {
        "groups": constrained_groups,
        "unit": reac_config.get("unit", 27), # Fixed conflict with mass (26)
        "format": reac_config.get("format", "TABLEAU"),
        "separator": reac_config.get("separator", ","),
        "resultante": tuple(reac_config.get("extract_components", ["DX", "DY", "DZ"])),
        "moment": tuple(reac_config.get("moment_components", ["DRX", "DRY", "DRZ"]))
    }
