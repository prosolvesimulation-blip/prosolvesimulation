# =========================================================
# Builder: ASSE_MAILLAGE
# Junta N malhas em UMA
# =========================================================

def build_asse_maillage(mesh_names, result_name="MAIL"):
    if not isinstance(mesh_names, list):
        raise ValueError("mesh_names deve ser lista")

    if len(mesh_names) == 0:
        raise RuntimeError("FATAL ERROR: No mesh units defined.")

    # Se só uma malha, nem precisa ASSE_MAILLAGE
    if len(mesh_names) == 1:
        return {
            "mode": "SINGLE",
            "final_mesh": mesh_names[0],
            "result_name": mesh_names[0],
            "items": []
        }

    items = [{"mesh": m} for m in mesh_names]

    return {
        "mode": "ASSE",
        "result_name": result_name,
        "final_mesh": result_name,
        "items": items
    }
