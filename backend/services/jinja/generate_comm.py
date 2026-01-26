# =========================================================
# generate_comm.py
# Gera arquivo .comm do Code_Aster a partir de JSON + Jinja
# =========================================================

import json
import sys
import argparse
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

# ---------------------------------------------------------
# 1. Configuração de Diretórios e Argumentos
# ---------------------------------------------------------
parser = argparse.ArgumentParser(description="Gera script .comm do Code_Aster")
parser.add_argument("--project_path", type=str, help="Caminho raiz do projeto")
args = parser.parse_args()

BASE_DIR = Path(__file__).resolve().parent
BUILDERS_DIR = BASE_DIR / "builders"
TEMPLATES_DIR = BASE_DIR / "templates"

if args.project_path:
    # Modo Produção: Usa a pasta simulation_files do projeto
    PROJECT_DIR = Path(args.project_path)
    SIM_DIR = PROJECT_DIR / "simulation_files"
    STUDY_DIR = SIM_DIR
    OUTPUT_DIR = SIM_DIR
else:
    # Modo Legado/Desenvolvimento: Usa as pastas locais
    STUDY_DIR = BASE_DIR / "study"
    OUTPUT_DIR = BASE_DIR / "output"

# ---------------------------------------------------------
# 2. Importação de Builders
# ---------------------------------------------------------
sys.path.insert(0, str(BUILDERS_DIR))

try:
    from asse_maillage import build_asse_maillage
    from affe_modele import build_affe_modele
    from defi_materiau import build_defi_materiau
    from affe_materiau import build_affe_materiau
    from affe_char_meca_ddl import build_affe_char_meca_ddl 
    from pesanteur import build_pesanteur
    from load_cases import build_load_cases
    from force_coque import build_force_coque
    from post_elem_mass import build_post_elem_mass
    from post_releve_t_reactions import build_post_releve_t_reactions
    from force_nodale import build_force_nodale
    from geometry import build_geometry
except ImportError as e:
    raise ImportError(f"Erro ao importar builders: {e}")

# 3. Leitura dos Arquivos de Configuração (JSON)
# ---------------------------------------------------------

def load_json(path, key=None):
    if not path.exists(): return [] if key else {}
    try:
        with open(path, encoding="utf-8", errors='replace') as f:
            data = json.load(f)
            return data.get(key, []) if key else data
    except Exception:
        return [] if key else {}

# A. Unified Project Config
project_file = PROJECT_DIR / "project.json"
project_config = load_json(project_file)

if not project_config:
    raise FileNotFoundError(f"Arquivo de projeto não encontrado em {project_file}")

# Mesh data now comes from project.json meshes key
mesh_config = project_config.get("meshes", [])
if not mesh_config:
    # Check if meshes are in a different key or if it's the old structure
    raise FileNotFoundError(f"Dados de malha ('meshes') não encontrados em {project_file}")

mesh_names = [m["name"] for m in mesh_config]

# B. Materials & Geometry (From project.json keys)
mat_props_list = project_config.get("materials", [])
# Material assignments are now expected inside each material object as 'assignedGroups'
# but we can also handle a separate list if present
assign_list = project_config.get("material_assignments", [])
if not assign_list and mat_props_list:
    # Synthesize internal assignments for builder compatibility
    assign_list = [{"material": m["name"], "groups": m.get("assignedGroups", [])} for m in mat_props_list]

geometry_list = project_config.get("geometries", [])

# F. Loadings (From project.json keys)
ddl_list = project_config.get("restrictions", []) # restrictions maps to DDL
meca_config = project_config.get("meca_statique", {})
pes_config = project_config.get("pesanteur", {})
lc_list = project_config.get("load_cases", [])
foc_config = project_config.get("force_coque", {})
mass_config = project_config.get("post_elem_mass", {})
reac_config = project_config.get("post_releve_t_reactions", {})

# Handle loads from unified list
all_loads = project_config.get("loads", [])
nod_list = [l for l in all_loads if l.get("type") == "FORCE_NODALE"]
pesanteur_loads = [l for l in all_loads if l.get("type") == "PESANTEUR"]

# If there's a legacy top-level pesanteur key, we could merge it, 
# but the current UI uses the unified 'loads' list.
if not pesanteur_loads and project_config.get("pesanteur"):
    lp = project_config.get("pesanteur")
    pesanteur_loads = lp if isinstance(lp, list) else [lp]

# ---------------------------------------------------------
# 4. Preparação dos Dados (Builders)
# ---------------------------------------------------------

FINAL_MESH = "MAIL"
FINAL_MODEL = "MODELE"
FINAL_CHMAT = "CHAM_MATER"
FINAL_CARA = "CARA_ELEM"
FINAL_DDL = "CHARGE_DDL"
FINAL_PES = "CHARGE_PES"
FINAL_NOD = "CHARGE_NOD"

# A. Assembly
asse_data = build_asse_maillage(mesh_names, result_name=FINAL_MESH)

# B & E. Geometry (Model + Properties)
geom_data = build_geometry(geometry_list, model_name=FINAL_MODEL, result_name=FINAL_CARA)
model_data = { "result_name": FINAL_MODEL, "mesh_name": FINAL_MESH, "items": geom_data["model_items"] }
for item in model_data["items"]: item["phenomene"] = "MECANIQUE"

# C & D. Materials
defi_mat_data = build_defi_materiau(mat_props_list)
affe_mat_data = build_affe_materiau(assign_list, model_name=FINAL_MODEL, result_name=FINAL_CHMAT)

# F. DDL & Forces
ddl_data = build_affe_char_meca_ddl(ddl_list, model_name=FINAL_MODEL, result_name=FINAL_DDL)
pes_data = build_pesanteur({"pesanteur": pesanteur_loads}, model_name=FINAL_MODEL, result_name=FINAL_PES)
foc_calc_data, foc_load_data = build_force_coque(foc_config, model_name=FINAL_MODEL)
reac_data = build_post_releve_t_reactions(reac_config, ddl_list)
nod_data = build_force_nodale(nod_list, model_name=FINAL_MODEL, result_name=FINAL_NOD)

# G. Load Cases Summary
lc_data = build_load_cases(
    lc_list, 
    meca_config, 
    pes_data=pes_data, 
    ddl_data=ddl_data, 
    model_name=FINAL_MODEL,
    reaction_extraction_data=reac_data,
    foc_data=foc_load_data,
    nod_data=nod_data
)

# H. Mass
mass_data = build_post_elem_mass(mass_config, model_name=FINAL_MODEL, field_mat_name=FINAL_CHMAT, cara_elem_name=FINAL_CARA)

# ---------------------------------------------------------
# 5. Configuração Jinja
# ---------------------------------------------------------
env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)), trim_blocks=True, lstrip_blocks=True)

try:
    tpl_preamble = env.get_template("preamble.j2")
    tpl_lire = env.get_template("lire_maillage.j2")
    tpl_asse = env.get_template("asse_maillage.j2")
    tpl_inspect = env.get_template("inspect_mesh.j2") 
    tpl_model = env.get_template("affe_modele.j2")
    tpl_defi = env.get_template("defi_materiau.j2")
    tpl_affe = env.get_template("affe_materiau.j2")
    tpl_cara = env.get_template("affe_cara_elem.j2")
    tpl_ddl = env.get_template("affe_char_meca_ddl.j2") 
    tpl_pes = env.get_template("pesanteur.j2")
    tpl_lc = env.get_template("load_cases.j2")
    tpl_foc_calc = env.get_template("force_coque_calc.j2")
    tpl_foc_load = env.get_template("force_coque_load.j2")
    tpl_nod = env.get_template("force_nodale.j2")
    tpl_mass = env.get_template("post_elem_mass.j2")
    tpl_geom_check = env.get_template("geometric_check.j2")
    tpl_results = env.get_template("extract_results.j2")
except Exception as e:
    raise RuntimeError(f"Error loading Jinja templates: {e}")

# ---------------------------------------------------------
# 6. Escrita do Arquivo .comm
# ---------------------------------------------------------
OUTPUT_DIR.mkdir(exist_ok=True)
comm_path = OUTPUT_DIR / "calcul.comm"
import io
import re

import datetime

# Resolve absolute paths for debugging
print(f"DEBUG: Script starting. Path: {Path(__file__).resolve()}")
print(f"DEBUG: PROJECT_DIR: {PROJECT_DIR.resolve()}")
print(f"DEBUG: OUTPUT_DIR: {OUTPUT_DIR.resolve()}")

comm_path = (OUTPUT_DIR / "calcul.comm").resolve()
print(f"Generating auditable script in: {comm_path}")

output_buffer = io.StringIO()

with output_buffer as f:
    f.write(f"# Generated at: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    f.write("DEBUT(LANG='FR')\n\n")
    
    f.write(tpl_preamble.render() + "\n")
    for i, mesh in enumerate(mesh_config):
        unit = mesh.get("unit", 80+i)
        f.write(tpl_lire.render(mesh_name=mesh["name"], unit=unit, filename=mesh.get("filename", f"{mesh['name']}.med")))
        f.write("\n\n\n\n")

    if asse_data["mode"] == "ASSE":
        f.write(tpl_asse.render(**asse_data))
    elif asse_data["mode"] == "SINGLE":
        if asse_data['final_mesh'] != FINAL_MESH:
            f.write(f"{FINAL_MESH} = {asse_data['final_mesh']}\n")
    f.write("\n\n\n\n")

    if model_data["items"]:
        f.write(tpl_model.render(**model_data))
        f.write("\n\n\n\n")

    if defi_mat_data or affe_mat_data["items"]:
        if defi_mat_data:
            f.write(tpl_defi.render(definitions=defi_mat_data) + "\n\n\n\n")
            
            # Robustness: if we have materials but NO assignments, 
            # create a default assignment to TOUT='OUI' using the first material
            if not affe_mat_data["items"]:
                first_mat_var = defi_mat_data[0]["var_name"]
                affe_mat_data["items"] = [{"mater": first_mat_var, "tout": "OUI"}]
                
        if affe_mat_data["items"]:
            f.write(tpl_affe.render(**affe_mat_data) + "\n\n\n\n")

    if geom_data["cara_items"]:
        f.write(tpl_cara.render(**geom_data))
        f.write("\n\n\n\n")

    if foc_calc_data:
        f.write(tpl_foc_calc.render(**foc_calc_data))
        f.write("\n\n\n\n")

    if ddl_data: f.write(tpl_ddl.render(commands=ddl_data) + "\n\n\n\n")
    if pes_data: f.write(tpl_pes.render(commands=pes_data) + "\n\n\n\n")
    if nod_data: f.write(tpl_nod.render(**nod_data) + "\n\n\n\n")
    if foc_load_data and foc_load_data.get("load_items"):
        f.write(tpl_foc_load.render(**foc_load_data) + "\n\n\n\n")

    if lc_data.get("runs"):
        for run in lc_data["runs"]:
            f.write(tpl_lc.render(**run))
            f.write("\n\n\n\n")

    f.write(tpl_geom_check.render(model_name=FINAL_MODEL, cara_elem_name=FINAL_CARA))
    f.write("\n\n\n\n")

    if lc_data.get("runs"):
        has_shells = any(item.get("type") == "COQUE" for item in geom_data.get("cara_items", []))
        f.write(tpl_results.render(has_shells=has_shells, cara_items=geom_data.get("cara_items", []), **lc_data))
        f.write("\n\n\n\n")

    f.write("FIN()\n")
    
    # Extração e Limpeza do conteúdo (dentro do bloco with)
    comm_content = output_buffer.getvalue()

# Limpeza e Escrita final
# Permite ate 4 quebras de linha para o respiro de 3 linhas vazias
comm_content = re.sub(r'\n{5,}', '\n\n\n\n', comm_content)

print(f"DEBUG: Writing {len(comm_content)} bytes to {comm_path}")
try:
    with open(comm_path, "w", encoding="utf-8") as f_out:
        f_out.write(comm_content)
    print(f"Success! .comm script generated at {comm_path}")
except Exception as e:
    print(f"CRITICAL ERROR writing script: {e}", file=sys.stderr)
    sys.exit(1)
