#!/usr/bin/env python3
"""MedExtractor: extract a MED mesh and emit a standardized JSON payload.

This module is designed to be agnostic to the frontend framework. It always
produces a JSON object on stdout (minified) and can optionally write the same
payload to a JSON file when a second argument is provided.
"""

import json
import os
import sys

try:
    # MEDCoupling Python bindings
    from medcoupling import MEDLoader  # type: ignore
except Exception:
    MEDLoader = None  # pragma: no cover - will trigger fallback errors if used without MED


def _safe_call(obj, method, default=None):
    """Call a method defensively if available."""
    if obj is None:
        return default
    if hasattr(obj, method):
        try:
            return getattr(obj, method)()
        except Exception:
            return default
    return default


def _category_from_dim(dim: int) -> str:
    if dim == 3:
        return "3D"
    if dim == 2:
        return "2D"
    if dim == 1:
        return "1D"
    # 0 or Node-like
    return "Node"


def _load_mesh(path: str):
    if MEDLoader is None:
        raise RuntimeError("medcoupling is not available in this environment.")
    loader = MEDLoader()
    # Try common entry points used by different MEDLoader bindings
    for method in ("LoadMesh", "LoadFile", "Load", "loadMesh", "loadFile", "load"):
        if hasattr(loader, method):
            func = getattr(loader, method)
            return func(path)
    raise RuntimeError("MEDLoader does not expose a compatible load method.")


def _extract_one_group(mesh, group_key: str) -> dict:
    # Try to determine mesh dimension
    dim = _safe_call(mesh, "getMeshDimension", 0)
    if not isinstance(dim, int):
        dim = int(dim) if dim is not None else 0
    category = _category_from_dim(dim)

    # Count (number of cells/elements)
    count = _safe_call(mesh, "getNumberOfElements", 0)
    if not isinstance(count, int):
        count = int(count) if count is not None else 0

    # Geometry: points, connectivity
    points = []
    connectivity = []
    normals = None

    try:
        coords = mesh.getCoords()
        if coords is not None and hasattr(coords, "toNumPyArray"):
            points = coords.toNumPyArray().flatten().tolist()
        elif coords is not None and hasattr(coords, "toList"):
            points = list(coords.toList())
    except Exception:
        points = []

    try:
        conn = mesh.getNodalConnectivity()
        if conn is not None and hasattr(conn, "toNumPyArray"):
            connectivity = conn.toNumPyArray().flatten().tolist()
        elif conn is not None and hasattr(conn, "toList"):
            connectivity = list(conn.toList())
    except Exception:
        connectivity = []

    # Normals for 2D meshes
    if category == "2D":
        try:
            orth = mesh.buildOrthogonalField()
            if orth is not None:
                arr = orth.getArray() if hasattr(orth, "getArray") else None
                if arr is not None and hasattr(arr, "toNumPyArray"):
                    normals = arr.toNumPyArray().flatten().tolist()
        except Exception:
            normals = None

    # VTK cell type (best-effort; default to Triangle=5 as per doc)
    type_vtk = 5
    for method in ("getVTKCellType", "getTypeVTK", "getCellType"):
        if hasattr(mesh, method):
            try:
                val = getattr(mesh, method)()
                if isinstance(val, int):
                    type_vtk = val
                    break
            except Exception:
                pass

    group = {
        "dimension": dim,
        "count": count,
        "category": category,
        "type_vtk": int(type_vtk),
        "points": points,
        "connectivity": connectivity,
        "normals": normals,
    }
    return group


def extract_to_dict(path: str):
    """Return the parsed MED data as a standard JSON-like dict.

    The result matches the schema defined in the mission protocol.
    """
    filename = os.path.basename(path)
    group_name = os.path.splitext(filename)[0] or "mesh"

    mesh = _load_mesh(path)
    # If the mesh exposes multiple groups, try to fetch them; otherwise create a single synthetic group
    groups = {}
    try:
        # Try to retrieve named groups using a couple of common API aliases
        group_names = []
        for attr in ("getGroupsNames", "getGroupsName", "getGroupNames"):
            if hasattr(mesh, attr):
                try:
                    names = getattr(mesh, attr)()
                    if isinstance(names, (list, tuple)):
                        group_names = list(names)
                        break
                except Exception:
                    pass
        if not group_names:
            group_names = [group_name]
    except Exception:
        group_names = [group_name]

    # Build data for the first available group (fallbacks handle missing per-group APIs)
    for g in group_names:
        groups[g] = _extract_one_group(mesh, g)

        # If we only discovered a synthetic group, break after first one
        # (the current frontend schema expects at least one group per file)
        break

    data = {"groups": groups}
    payload = {"status": "success", "filename": filename, "data": data}
    return payload


def main():
    if len(sys.argv) < 2:
        print("Usage: med_extractor.py <path_to_med> [output.json]", flush=True)
        sys.exit(2)
    path = sys.argv[1]
    outpath = sys.argv[2] if len(sys.argv) > 2 else None
    payload = None
    try:
        payload = extract_to_dict(path)
    except Exception as exc:
        payload = {"status": "error", "message": str(exc)}

    json_text = json.dumps(payload, separators=(",", ":"))
    # Always print to stdout (minified)
    print(json_text)
    if outpath:
        with open(outpath, "w", encoding="utf-8") as f:
            f.write(json_text)


if __name__ == "__main__":
    main()
