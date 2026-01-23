def build_post_releve_t_reactions(config, ddl_list):
    """
    Builds data for reaction extraction.
    Identifies which groups have constraints (from ddl_list).
    """
    reac_config = config.get("reaction_extraction", {})
    if not reac_config.get("enabled", False):
        return None

    # Get unique groups from ddl_list
    constrained_groups = list(set([item["group"] for item in ddl_list if "group" in item]))

    if not constrained_groups:
        return None

    return {
        "groups": constrained_groups,
        "unit": reac_config.get("unit", 26),
        "format": reac_config.get("format", "TABLEAU"),
        "separator": reac_config.get("separator", ","),
        "resultante": tuple(reac_config.get("extract_components", ["DX", "DY", "DZ"])),
        "moment": tuple(reac_config.get("moment_components", ["DRX", "DRY", "DRZ"]))
    }
