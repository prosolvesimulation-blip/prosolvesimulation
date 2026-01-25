import os
import json
import sys
from sectionproperties.pre.library import (
    rectangular_section,
    rectangular_hollow_section,
    circular_section,
    circular_hollow_section,
    mono_i_section
)
from sectionproperties.analysis import Section

# ==========================================================
# CONFIGURAÇÃO DE SAÍDA E PARÂMETROS
# ==========================================================
DIRETORIO_SAIDA = r"C:\Users\jorge\OneDrive\ProSolveSimulation\testcases\hibrido"
NOME_ARQUIVO = "section_mesh.json"

TIPO_SECAO = 'I_SECTION'
PARAMS = {
    'h': 200, 'bf_top': 150, 'bf_bot': 150, 
    'tf_top': 12, 'tf_bot': 12, 'tw': 8, 'r': 5,
    'offset_y': 0.0, 'offset_z': 0.0, 'rotation': 0.0
}
# ==========================================================

def calculate_and_save_json():
    try:
        # 1. PARSE E GEOMETRIA
        p = {k: float(v) for k, v in PARAMS.items() if v is not None}
        geometry = None
        
        if TIPO_SECAO == 'RECTANGLE':
            geometry = rectangular_section(d=p.get('hy', 100), b=p.get('hz', 50))
        elif TIPO_SECAO == 'I_SECTION':
            geometry = mono_i_section(
                d=p.get('h', 200), b_t=p.get('bf_top', 100), b_b=p.get('bf_bot', 100), 
                t_ft=p.get('tf_top', 10), t_fb=p.get('tf_bot', 10), t_w=p.get('tw', 6), 
                r=p.get('r', 0), n_r=8
            )

        # 2. TRANSFORMAÇÕES (3-STEP)
        geometry = geometry.align_center(align_to=(0, 0))
        if abs(p.get('rotation', 0)) > 1e-9:
            geometry = geometry.rotate_section(angle=p['rotation'], rot_point=(0, 0))
        if abs(p.get('offset_y', 0)) > 1e-9 or abs(p.get('offset_z', 0)) > 1e-9:
            geometry = geometry.shift_section(x_offset=p['offset_z'], y_offset=p['offset_y'])

        # 3. GERAÇÃO DA MALHA
        # Mesh size baseado na menor espessura
        m_size = min(p.get('tw', 10), p.get('tf_top', 10), 10.0) / 1.5
        geometry.create_mesh(mesh_sizes=[max(m_size, 2.0)])
        
        # 4. ANÁLISE (Proteção contra erro plástico do Shapely)
        sec = Section(geometry)
        sec.calculate_geometric_properties()
        try:
            sec.calculate_plastic_properties()
        except:
            print("[AVISO] Propriedades plásticas ignoradas devido a erro de biblioteca.")

        # 5. CONVERSÃO PARA FORMATO VTK (JSON)
        sp_mesh = geometry.mesh
        vertices = sp_mesh.get('vertices')
        triangles = sp_mesh.get('triangles')
        
        # Converter vértices 2D (Y, Z) para lista flat 3D (0, Y, Z)
        points_3d = []
        for v in vertices:
            points_3d.extend([0.0, float(v[0]), float(v[1])]) # X=0

        # Garantir triângulos de 3 nós (Linear)
        if triangles is not None and len(triangles[0]) == 6:
            triangles = triangles[:, :3]
        
        # Montar dicionário final
        output_data = {
            "status": "success",
            "vtk_type": 5, # VTK_TRIANGLE
            "points": points_3d,
            "connectivity": triangles.tolist(),
            "properties": {
                "Area": float(sec.section_props.area),
                "Iyy": float(sec.section_props.ixx_c), # Inércia Y do SP
                "Izz": float(sec.section_props.iyy_c)  # Inércia Z do SP
            }
        }

        # 6. SALVAR NO DISCO
        if not os.path.exists(DIRETORIO_SAIDA):
            os.makedirs(DIRETORIO_SAIDA)
            
        caminho_final = os.path.join(DIRETORIO_SAIDA, NOME_ARQUIVO)
        with open(caminho_final, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, separators=(',', ':'))
            
        print(f"--- SUCESSO ---")
        print(f"Arquivo salvo em: {caminho_final}")
        print(f"Área: {output_data['properties']['Area']:.2f} mm2")

    except Exception as e:
        print(f"Erro no processamento: {e}")

if __name__ == "__main__":
    calculate_and_save_json()