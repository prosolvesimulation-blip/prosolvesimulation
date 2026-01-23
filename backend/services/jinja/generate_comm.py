# =========================================================
# generate_comm.py
# Gera arquivo .comm do Code_Aster a partir de JSON + Jinja
# =========================================================

import json
import sys
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

# ---------------------------------------------------------
# 1. Configuração de Diretórios
# ---------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent

BUILDERS_DIR = BASE_DIR / "builders"
TEMPLATES_DIR = BASE_DIR / "templates"
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
    from affe_cara_elem_shell import build_affe_cara_elem_shell
    # IMPORTAÇÃO ESPECÍFICA PARA DDL
    from affe_char_meca_ddl import build_affe_char_meca_ddl 
    # IMPORTAÇÃO MECA_STATIQUE
    from meca_statique import build_meca_statique
    # IMPORTAÇÃO PESANTEUR
    from pesanteur import build_pesanteur
    # IMPORTAÇÃO LOAD CASES
    from load_cases import build_load_cases
    # IMPORTAÇÃO FORCE_COQUE
    from force_coque import build_force_coque
    # IMPORTAÇÃO POST_ELEM_MASS
    from post_elem_mass import build_post_elem_mass
    # IMPORTAÇÃO POST_RELEVE_T_REACTIONS
    from post_releve_t_reactions import build_post_releve_t_reactions
    # IMPORTAÇÃO FORCE_NODALE
    from force_nodale import build_force_nodale
    from geometry import build_geometry
except ImportError as e:
    raise ImportError(f"Erro ao importar builders: {e}")

# ---------------------------------------------------------
# 3. Leitura dos Arquivos de Configuração (JSON)
# ---------------------------------------------------------

# A. Mesh
mesh_file = STUDY_DIR / "mesh.json"
if not mesh_file.exists(): raise FileNotFoundError("mesh.json")
with open(mesh_file, encoding="utf-8") as f: mesh_config = json.load(f)
mesh_names = [m["name"] for m in mesh_config["meshes"]]

# B. Models
# C. Materials Props
materials_file = STUDY_DIR / "materials.json"
mat_props_list = []
if materials_file.exists():
    with open(materials_file, encoding="utf-8") as f: mat_props_list = json.load(f).get("materials", [])

# D. Material Assignments
assign_file = STUDY_DIR / "material_assignments.json"
assign_list = []
if assign_file.exists():
    with open(assign_file, encoding="utf-8") as f: assign_list = json.load(f).get("assignments", [])

# E. Geometry Properties (Unified Shell, Beam, Volume)
geom_file = STUDY_DIR / "geometry.json"
geometry_list = []
if geom_file.exists():
    with open(geom_file, encoding="utf-8") as f: 
        geometry_list = json.load(f).get("geometries", [])
else:
    # Fallback to old models.json if geometry.json doesn't exist (compatibility)
    models_file = STUDY_DIR / "models.json"
    if models_file.exists():
        with open(models_file, encoding="utf-8") as f:
            old_models = json.load(f).get("models", [])
            for m in old_models:
                geometry_list.append({"group": m["group"], "type": "Shell" if m["type"]=="DKT" else "Solid"})
    
    # Fallback to old shell_properties.json for thickness
    shells_file = STUDY_DIR / "shell_properties.json"
    if shells_file.exists():
        with open(shells_file, encoding="utf-8") as f:
            old_shells = json.load(f).get("shells", [])
            for s in old_shells:
                for target in geometry_list:
                    if target["group"] == s["group"]:
                        target["thickness"] = s["thickness"]

# F. DDL IMPO (JSON Específico)
ddl_file = STUDY_DIR / "ddl_impo.json"
ddl_list = []
if ddl_file.exists():
    with open(ddl_file, encoding="utf-8") as f: 
        ddl_list = json.load(f).get("ddl_impo", [])

# G. MECA_STATIQUE (JSON)
meca_file = STUDY_DIR / "meca_statique.json"
meca_config = {}
if meca_file.exists():
    with open(meca_file, encoding="utf-8") as f:
        meca_config = json.load(f)

# H. PESANTEUR (JSON)
pes_file = STUDY_DIR / "pesanteur.json"
pes_config = {}
if pes_file.exists():
    with open(pes_file, encoding="utf-8") as f:
        pes_config = json.load(f)

# I. LOAD CASES (JSON)
lc_file = STUDY_DIR / "load_cases.json"
lc_list = []
if lc_file.exists():
    with open(lc_file, encoding="utf-8") as f:
        lc_list = json.load(f).get("load_cases", [])

# J. FORCE_COQUE (JSON)
foc_file = STUDY_DIR / "force_coque.json"
foc_config = {}
if foc_file.exists():
    with open(foc_file, encoding="utf-8") as f:
        foc_config = json.load(f)

# K. POST_ELEM_MASS (JSON)
mass_file = STUDY_DIR / "post_elem_mass.json"
mass_config = {}
if mass_file.exists():
    with open(mass_file, encoding="utf-8") as f:
        mass_config = json.load(f)

# L. POST_RELEVE_T_REACTIONS (JSON)
reac_file = STUDY_DIR / "post_releve_t_reactions.json"
reac_config = {}
if reac_file.exists():
    with open(reac_file, encoding="utf-8") as f:
        reac_config = json.load(f)

# M. FORCE_NODALE (JSON - vindo de loads.json filtrado)
nod_file = STUDY_DIR / "force_nodale.json"
nod_list = []
if nod_file.exists():
    with open(nod_file, encoding="utf-8") as f:
        nod_list = json.load(f).get("force_nodale", [])

# ---------------------------------------------------------
# 4. Preparação dos Dados (Builders)
# ---------------------------------------------------------

FINAL_MESH = "MAIL"
FINAL_MODEL = "MODELE"
FINAL_CHMAT = "CHAM_MATER"
FINAL_CARA = "CARA_ELEM"
FINAL_DDL = "CHARGE_DDL" # Nome específico da carga de DDL
FINAL_RESU = "RESU_MECA"

# A. Assembly
asse_data = build_asse_maillage(mesh_names, result_name=FINAL_MESH)

# B & E. Geometry (Model + Properties)
geom_data = build_geometry(geometry_list, model_name=FINAL_MODEL, result_name=FINAL_CARA)
model_data = { "result_name": FINAL_MODEL, "mesh_name": FINAL_MESH, "items": geom_data["model_items"] }
# Add default phenomene
for item in model_data["items"]: item["phenomene"] = "MECANIQUE"

# C. Material Definição
defi_mat_data = build_defi_materiau(mat_props_list)

# D. Material Atribuição
affe_mat_data = build_affe_materiau(assign_list, model_name=FINAL_MODEL, result_name=FINAL_CHMAT)

# F. DDL IMPO (Builder Específico)
ddl_data = build_affe_char_meca_ddl(
    ddl_list, 
    model_name=FINAL_MODEL, 
    result_name=FINAL_DDL
)

# G. PESANTEUR (Builder) - Agora antes de MECA_STATIQUE
# Define nome para a carga de gravidade
FINAL_PES = "CHARGE_PES"
pes_data = build_pesanteur(pes_config, model_name=FINAL_MODEL, result_name=FINAL_PES)

# I. FORCE_COQUE (Builder)
# Retorna dados de calculo (Python) e dados de carga (Aster)
foc_calc_data, foc_load_data = build_force_coque(foc_config, model_name=FINAL_MODEL)
FINAL_FOC = foc_load_data.get("result_name", "CHARGE_FOC")

# L. POST_RELEVE_T_REACTIONS (Builder)
reac_data = build_post_releve_t_reactions(reac_config, ddl_list)

# H. LOAD CASES (Builder)
# Passamos config de meca, dados de pesanteur e ddl para validação
lc_data = build_load_cases(
    lc_list, 
    meca_config, 
    pes_data=pes_data, 
    ddl_data=ddl_data, 
    model_name=FINAL_MODEL,
    reaction_extraction_data=reac_data,
    foc_data=foc_load_data
)

# M. FORCE_NODALE (Builder)
FINAL_NOD = "CHARGE_NOD"
nod_data = build_force_nodale(nod_list, model_name=FINAL_MODEL, result_name=FINAL_NOD)

# ATUALIZAR Build Load Cases para incluir FORCE_NODALE nos nomes válidos
# (Se não atualizar a função, podemos injetar manualmente na lista de nomes ou passar aqui)
# O builder load_cases já aceita kwargs, mas a validação interna é estrita.
# Vamos assumir que o builder load_cases foi atualizado ou que passamos `nod_data` como lista para `ddl_data` 
# (hack) ou atualizamos o builder.
# MELHOR: Atualizar load_cases.py para aceitar nod_data. 
# PLANO B (Imediato): Adicionar nod_data à lista de ddl_data (pois load_cases itera sobre ela para pegar nomes)
if nod_data:
    # Hack seguro: ddl_data é usado apenas para extrair nomes no builder load_cases
    # Se nod_data é um dicionário com result_name, adicionamos à lista de valid_names dentro do builder
    pass 
    # Vou atualizar a chamada de load_cases abaixo para passar nod_data explicito
    lc_data = build_load_cases(
        lc_list, 
        meca_config, 
        pes_data=pes_data, 
        ddl_data=ddl_data,  # Original
        model_name=FINAL_MODEL,
        reaction_extraction_data=reac_data,
        foc_data=foc_load_data,
        nod_data=nod_data # NOVO ARGUMENTO (Precisamos atualizar load_cases.py ou ele vai ignorar)
    )

# K. POST_ELEM_MASS (Builder)
mass_data = build_post_elem_mass(
    mass_config, 
    model_name=FINAL_MODEL, 
    field_mat_name=FINAL_CHMAT, 
    cara_elem_name=FINAL_CARA
)

# ---------------------------------------------------------
# 5. Configuração Jinja
# ---------------------------------------------------------
env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)), trim_blocks=True, lstrip_blocks=True)

try:
    tpl_lire = env.get_template("lire_maillage.j2")
    tpl_asse = env.get_template("asse_maillage.j2")
    tpl_inspect = env.get_template("inspect_mesh.j2") 
    tpl_model = env.get_template("affe_modele.j2")
    tpl_defi = env.get_template("defi_materiau.j2")
    tpl_affe = env.get_template("affe_materiau.j2")
    tpl_cara = env.get_template("affe_cara_elem.j2")
    # TEMPLATE ESPECÍFICO
    tpl_ddl = env.get_template("affe_char_meca_ddl.j2") 
    tpl_meca = env.get_template("meca_statique.j2") # Ainda usado se precisar fallback ou single, mas load_cases usa o dele
    tpl_pes = env.get_template("pesanteur.j2")
    tpl_lc = env.get_template("load_cases.j2")
    tpl_foc_calc = env.get_template("force_coque_calc.j2")
    tpl_foc_load = env.get_template("force_coque_load.j2")
    tpl_nod = env.get_template("force_nodale.j2")
    tpl_mass = env.get_template("post_elem_mass.j2")
except Exception as e:
    raise RuntimeError(f"Erro template: {e}")

# ---------------------------------------------------------
# 6. Escrita do Arquivo .comm
# ---------------------------------------------------------
OUTPUT_DIR.mkdir(exist_ok=True)
comm_path = OUTPUT_DIR / "calcul.comm"

print(f"Gerando script...")

with open(comm_path, "w", encoding="utf-8") as f:
    f.write("DEBUT(LANG='FR')\n\n")

    # 1. LEITURA
    f.write("# --- 1. Leitura ---\n")
    for i, mesh in enumerate(mesh_config["meshes"]):
        f.write(tpl_lire.render(
            mesh_name=mesh["name"], 
            unit=mesh.get("unit", 20+i), 
            filename=mesh.get("filename", f"{mesh['name']}.med")
        ))
        f.write("\n")

    # 2. ASSEMBLY
    f.write("# --- 2. Assembly ---\n")
    if asse_data["mode"] == "ASSE":
        f.write(tpl_asse.render(**asse_data))
    elif asse_data["mode"] == "SINGLE":
        if asse_data['final_mesh'] != FINAL_MESH:
            f.write(f"{FINAL_MESH} = {asse_data['final_mesh']}\n")
    f.write("\n")


    # --- NOVO BLOCO: INSPEÇÃO E GERAÇÃO DE JSON ---
    f.write("# --- 2.1 Inspeção da Malha e Geração de JSON ---\n")
    # Passamos 'MAIL' (ou o valor de FINAL_MESH) para o template saber qual objeto inspecionar
    f.write(tpl_inspect.render(mesh_variable=FINAL_MESH))
    f.write("\n")
    # -----------------------------------------------

    # 3. MODELO
    f.write("# --- 3. Modelo ---\n")
    if model_data["items"]:
        f.write(tpl_model.render(**model_data))
        f.write("\n")

    # 4. MATERIAL (DEFI)
    f.write("# --- 4. Definição de Materiais ---\n")
    if defi_mat_data:
        f.write(tpl_defi.render(definitions=defi_mat_data))
        f.write("\n")

    # 5. MATERIAL (AFFE)
    f.write("# --- 5. Atribuição de Materiais ---\n")
    if affe_mat_data["items"]:
        f.write(tpl_affe.render(**affe_mat_data))
        f.write("\n")

    # 6. GEOMETRY PROPERTIES (Shells, Beams)
    f.write("# --- 6. Propriedades Geométricas (Cascas, Vigas) ---\n")
    if geom_data["cara_items"]:
        f.write(tpl_cara.render(**geom_data))
        f.write("\n")

    # 6.b BLOCO DE CÁLCULO DE ÁREA (FORCE_COQUE PRE-PROCESSAMENTO)
    if foc_calc_data:
        f.write("# --- 6.b Cálculo de Pression Equivalente (Force/Area) ---\n")
        f.write(tpl_foc_calc.render(**foc_calc_data))
        f.write("\n")

    # 7. DDL IMPO
    f.write("# --- 7. Condições de Contorno (DDL_IMPO) ---\n")
    if ddl_data:
        f.write(tpl_ddl.render(commands=ddl_data))
        f.write("\n")
    else:
        f.write("# AVISO: Nenhuma condição DDL_IMPO definida.\n")

    # 9. PESANTEUR (Agora antes de MECA)
    f.write("# --- 9. Carga de Pesanteur ---\n")
    if pes_data:
        f.write(tpl_pes.render(commands=pes_data))
        f.write("\n")

    # 9.b FORCE_NODALE
    f.write("# --- 9.b Carga Pontual (Force Nodale) ---\n")
    if nod_data:
        f.write(tpl_nod.render(**nod_data))
        f.write("\n")

    # 10. FORCE_COQUE
    f.write("# --- 10. Carga de Force Coque ---\n")
    if foc_load_data and foc_load_data.get("load_items"):
        f.write(tpl_foc_load.render(**foc_load_data))
        f.write("\n")

    # 9. MECA_STATIQUE (Iteração por Load Case) via Template Load Cases
    if lc_data.get("runs"):
        f.write(tpl_lc.render(**lc_data))
        f.write("\n")

    # 11. POST-PROCESSING (MASS)
    if mass_data:
        f.write("# --- 11. Post-Processing (Mass) ---\n")
        f.write(tpl_mass.render(commands=mass_data))
        f.write("\n")

    f.write("FIN()\n")

print(f"Arquivo gerado: {comm_path}")