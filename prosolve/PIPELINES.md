# ProSolve Asset & Logic Pipelines

This document maps the flow of data and the scripts involved in each functional area of the ProSolve application.

---

## 1. Model Tab (Mesh Configuration)
**Goal**: Import a MED file and extract its structure (groups, nodes, elements).

*   **Frontend**: `ModelConfig.tsx` (Triggering mesh analysis)
*   **API Route**: `/api/mesh_dna` (in `routes.py`)
*   **Service Core**: `med_extractor.py` (Uses MEDCoupling)
*   **Pipeline**: `.med file` → `med_extractor.py` → `JSON DNA` → `Frontend`

---

## 2. Geometry Tab (Cross-Sections)
**Goal**: Define beam profiles and calculate their 2D mechanical properties.

*   **Frontend**: `GeometryConfig.tsx` (Triggering calculation)
*   **API Route**: `/api/calculate_section` (in `routes.py`)
*   **Service**: `section_calculator.py`
*   **Engine**: `section_extractor.py` (Wraps `sectionproperties` library)
*   **Pipeline**: `Section Params` → `section_calculator.py` → `Properties + 2D Mesh` → `Frontend`

---

## 3. 3D View Tab (Live Visualization)
**Goal**: Native VTK extrusion of 1D/2D meshes using section data in-memory.

*   **Frontend**: `ThreeDModel.tsx` / `VtkMeshViewer.tsx`
*   **API Route**: `/3d/generate` (in `routes.py`)
*   **Orchestrator**: `vtk_extruder.py` (Function: `med_to_vtk_pipeline`)
*   **Mesh Extraction**: `med_mesher.py` (Standalone via Salome environment)
*   **Extrusion Engine**: `vtk_extruder.py` (In-memory functions: `extrude_beam_memory`, `extrude_shell_memory`)
*   **Pipeline**: `.med file` → `med_mesher.py` → `vtk_extruder.py` (+ Section Data) → `Final 3D JSON` → `Frontend`

---

## 4. Restrictions & Loads Tab (Analysis Setup)
**Goal**: Define boundary conditions and generate the Code_Aster command file.

*   **Frontend**: `RestrictionsConfig.tsx` / `LoadsConfig.tsx`
*   **API Route**: `/api/save_project` (in `routes.py`)
*   **Generator**: `generate_comm.py` (Jinja2 Pipeline)
*   **Templates**: `backend/services/jinja/templates/*.j2`
*   **Pipeline**: `UI State` → `generate_comm.py` → `.comm file` → `Code_Aster`

---

## 5. Results Tab (Post-Processing)
**Goal**: Analyze simulation outputs and visualize result fields (Stress/Displacement).

*   **Frontend**: `ResultsView.tsx`
*   **API Route**: `/post/results` and `/post/field`
*   **Data Extraction**: `med_results_service.py`
*   **VTK Processor**: `vtk_analysis_processor.py` (Maps fields to VTK scalars)
*   **Reporting**: `med_analysis_report.py`
*   **Pipeline**: `resu.med` → `med_results_service.py` → `vtk_analysis_processor.py` → `Visual JSON` → `Frontend`
---
 
 ## 6. Report Tab (Documentation)
 **Goal**: Generate a professional .DOCX report with project configurations and results.
 
 *   **Frontend**: `ReportTab.tsx` (Handles section selection and generation trigger)
 *   **API Route**: `/api/report/generate` and `/api/report/open` (in `routes.py`)
 *   **Report Engine**: `report_service.py` (Uses `python-docx`)
 *   **Data Aggregator**: `routes.py` (Collects data from `project.json` and CSV results)
 *   **Pipeline**: `Selection + project.json` → `report_service.py` → `.docx file` → `User Open`
 
 ---
 
 ## 7. Command & Export Generation (.comm / .export)
 **Goal**: Transform UI state into machine-readable instructions for the Code_Aster solver.
 
 *   **Trigger**: Frontend `Save Project` button.
 *   **API Route**: `/api/save_project` (in `routes.py`).
 *   **Workflow**:
     1.  **JSON Save**: Writes the master `project.json` to the project root.
     2.  **Comm Gen**: Executes `generate_comm.py` (Python + Jinja2).
         *   Reads `project.json`.
         *   Uses `builders/` logic to prepare solver commands.
         *   Renders `calcul.comm` using standard templates.
     3.  **Export Gen**: `routes.py` renders the `export.j2` template.
         *   Maps absolute paths for mesh files, message files, and result outputs.
         *   Defines logical units (80, 81...) for the solver.
 *   **Result**: Creates `calcul.comm` and `export.export` inside the `simulation_files/` directory.
 *   **Python Builders** (`backend/services/jinja/builders/`):
     *   `asse_maillage.py`, `affe_modele.py`, `defi_materiau.py`, `affe_materiau.py`, `geometry.py`, `affe_char_meca_ddl.py`, `pesanteur.py`, `load_cases.py`, `force_coque.py`, `force_nodale.py`, `post_elem_mass.py`, `post_releve_t_reactions.py`.
 *   **Jinja2 Templates** (`backend/services/jinja/templates/`):
     *   `preamble.j2`, `lire_maillage.j2`, `asse_maillage.j2`, `affe_modele.j2`, `defi_materiau.j2`, `affe_materiau.j2`, `affe_cara_elem.j2`, `affe_char_meca_ddl.j2`, `pesanteur.j2`, `load_cases.j2`, `force_nodale.j2`, `export.j2`, `extract_results.j2`, `post_elem_mass.j2`.
 *   **Pipeline**: `UI State` → `project.json` → `generate_comm.py` + `export.j2` → `.comm + .export`
