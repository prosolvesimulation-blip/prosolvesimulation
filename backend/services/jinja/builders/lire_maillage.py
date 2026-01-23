# =========================================================
# Builder: LIRE_MAILLAGE (Code_Aster)
# Responsabilidade:
# - Validar dados
# - Gerar corpo do comando
# - Calcular UNITE automaticamente
# =========================================================

def build_lire_maillages(meshes, unit_start):
    """
    meshes: lista de dicts com:
        - name   : nome do concept (obrigatório)
        - format : MED | ASTER (opcional, default MED)

    unit_start: inteiro (ex: 80)
    """

    if not isinstance(meshes, list) or not meshes:
        raise ValueError("meshes deve ser uma lista não vazia")

    if not isinstance(unit_start, int):
        raise ValueError("unit_start deve ser inteiro")

    seen_names = set()
    maillages = []

    for idx, mesh in enumerate(meshes):
        if not isinstance(mesh, dict):
            raise ValueError("Cada mesh deve ser um dicionário")

        name = mesh.get("name")
        format = mesh.get("format", "MED")

        if not name or not isinstance(name, str):
            raise ValueError("Cada mesh precisa de um 'name' válido")

        if name in seen_names:
            raise ValueError(f"Nome de malha duplicado: {name}")
        seen_names.add(name)

        if format not in ("MED", "ASTER"):
            raise ValueError(
                f"Formato inválido para {name}: {format}"
            )

        unite = unit_start + idx

        body_lines = [
            f"    FORMAT='{format}',",
            f"    UNITE={unite},",
        ]

        maillages.append({
            "name": name,
            "body": "\n".join(body_lines)
        })

    return maillages
