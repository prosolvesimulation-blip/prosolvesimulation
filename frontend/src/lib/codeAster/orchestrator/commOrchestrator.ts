/**
 * Code_Aster .comm Orchestration Service
 * Collects commands from all tabs and orchestrates complete MECA_STATIQUE simulation
 */

// --- Core Types for Orchestration ---

export interface MeshCommands {
    lireCommands: string[]
    asseCommands: string[]
    finalMeshName: string
}

export interface ModelCommands {
    commPreview: string
    caraCommands: string[]
}

export interface MaterialCommands {
    defiCommands: string[]
    affeCommands: string[]
}

export interface LoadCommands {
    forceCommands: string[]
    pressureCommands: string[]
    gravityCommands: string[]
    totalLoadName: string
}

export interface RestrictionCommands {
    ddlCommands: string[]
    faceCommands: string[]
    edgeCommands: string[]
}

export interface MecaStatiqueConfig {
    modele: string
    cham_mater: string
    cara_elem?: string
    excit: Array<{
        charge: string
        fonc_mult?: string
    }>
    inst?: number
    option?: 'SIEF_ELGA' | 'SANS'
    info?: number
    solveur?: any
}

export interface CommOrchestrationResult {
    meshSection: string
    modelSection: string
    materialSection: string
    loadSection: string
    restrictionSection: string
    mecaStatiqueSection: string
    postProcessingSection: string
    fullCommFile: string
}

// --- Orchestration Service ---

export class CommOrchestrator {
    private static instance: CommOrchestrator
    
    private constructor() {}
    
    public static getInstance(): CommOrchestrator {
        if (!CommOrchestrator.instance) {
            CommOrchestrator.instance = new CommOrchestrator()
        }
        return CommOrchestrator.instance
    }
    
    /**
     * Orchestrate complete .comm file generation from projectConfig
     */
    public orchestrateComm(projectConfig: any): CommOrchestrationResult {
        const meshCommands = projectConfig.mesh_commands || { lireCommands: [], asseCommands: [], finalMeshName: 'MAIL' }
        const modelCommands = projectConfig.model_commands || { commPreview: '', caraCommands: [] }
        console.log('Orchestrator - Received commPreview:', modelCommands.commPreview)
        
        const materialCommands = projectConfig.material_commands || { defiCommands: [], affeCommands: [] }
        const loadCommands = projectConfig.load_commands || { forceCommands: [], pressureCommands: [], gravityCommands: [], totalLoadName: 'CHARGE_TOTAL' }
        const restrictionCommands = projectConfig.restriction_commands || { ddlCommands: [], faceCommands: [], edgeCommands: [] }
        const analysisConfig = projectConfig.analysis
        const postProcessingConfig = {
            mass_calculations: projectConfig.post_elem_mass?.mass_calculations || [],
            reaction_cases: projectConfig.post_releve_t_reactions?.reaction_cases || []
        }
        
        // Generate individual sections
        const meshSection = this.generateMeshSection(meshCommands)
        const modelSection = this.generateModelSection(modelCommands)
        const materialSection = this.generateMaterialSection(materialCommands)
        const loadSection = this.generateLoadSection(loadCommands)
        const restrictionSection = this.generateRestrictionSection(restrictionCommands)
        const mecaStatiqueSection = this.generateMecaStatiqueSection({
            modele: 'MODELE',
            cham_mater: 'CHAM_MATER',
            cara_elem: modelCommands.caraCommands.length > 0 ? 'CARA_ELEM' : undefined,
            excit: this.buildExcitList(loadCommands, restrictionCommands),
            ...analysisConfig
        })
        const postProcessingSection = this.generatePostProcessingSection(postProcessingConfig)
        
        // Combine into full .comm file
        const fullCommFile = this.assembleFullComm({
            meshSection,
            modelSection,
            materialSection,
            loadSection,
            restrictionSection,
            mecaStatiqueSection,
            postProcessingSection
        })
        
        
        return {
            meshSection,
            modelSection,
            materialSection,
            loadSection,
            restrictionSection,
            mecaStatiqueSection,
            postProcessingSection,
            fullCommFile
        }
    }
    
    // --- Section Generators ---
    
    private generateMeshSection(meshCommands: MeshCommands): string {
        let section = '# --- 1. Leitura ---\n'
        
        // LIRE_MAILLAGE commands
        meshCommands.lireCommands.forEach(cmd => {
            section += `${cmd}\n`
        })
        
        section += '\n# --- 2. Assembly ---\n'
        
        // ASSE_MAILLAGE commands
        meshCommands.asseCommands.forEach(cmd => {
            section += `${cmd}\n`
        })
        
        // Add mesh inspection
        section += '\n# --- 2.1 Inspeção da Malha e Geração de JSON ---\n'
        section += `mesh_inspection = INSPECT_MAILLAGE(MAILLAGE=${meshCommands.finalMeshName});\n`
        
        return section
    }
    
    private generateModelSection(modelCommands: ModelCommands): string {
        let section = '\n# --- 3. Modelo ---\n'
        
        if (modelCommands.commPreview) {
            section += `${modelCommands.commPreview}\n`
        }
        
        return section
    }
    
    private generateMaterialSection(materialCommands: MaterialCommands): string {
        let section = '\n# --- 4. Definição de Materiais ---\n'
        
        materialCommands.defiCommands.forEach(cmd => {
            section += `${cmd}\n`
        })
        
        section += '\n# --- 5. Atribuição de Materiais ---\n'
        materialCommands.affeCommands.forEach(cmd => {
            section += `${cmd}\n`
        })
        
        return section
    }
    
    private generateLoadSection(loadCommands: LoadCommands): string {
        let section = '\n# --- 8. Carregamentos ---\n'
        
        // Gravity loads
        if (loadCommands.gravityCommands.length > 0) {
            section += '# --- 8.1 Pesanteur ---\n'
            loadCommands.gravityCommands.forEach(cmd => {
                section += `${cmd}\n`
            })
        }
        
        // Force loads
        if (loadCommands.forceCommands.length > 0) {
            section += '\n# --- 8.2 Forças Nodais ---\n'
            loadCommands.forceCommands.forEach(cmd => {
                section += `${cmd}\n`
            })
        }
        
        // Pressure loads
        if (loadCommands.pressureCommands.length > 0) {
            section += '\n# --- 8.3 Pressões ---\n'
            loadCommands.pressureCommands.forEach(cmd => {
                section += `${cmd}\n`
            })
        }
        
        return section
    }
    
    private generateRestrictionSection(restrictionCommands: RestrictionCommands): string {
        let section = '\n# --- 7. Condições de Contorno ---\n'
        
        // DDL_IMPO (nodal constraints)
        if (restrictionCommands.ddlCommands.length > 0) {
            section += '# --- 7.1 Condições de Contorno Nodais ---\n'
            restrictionCommands.ddlCommands.forEach(cmd => {
                section += `${cmd}\n`
            })
        }
        
        // FACE_IMPO (face constraints)
        if (restrictionCommands.faceCommands.length > 0) {
            section += '\n# --- 7.2 Condições de Contorno de Face ---\n'
            restrictionCommands.faceCommands.forEach(cmd => {
                section += `${cmd}\n`
            })
        }
        
        // ARETE_IMPO (edge constraints)
        if (restrictionCommands.edgeCommands.length > 0) {
            section += '\n# --- 7.3 Condições de Contorno de Aresta ---\n'
            restrictionCommands.edgeCommands.forEach(cmd => {
                section += `${cmd}\n`
            })
        }
        
        return section
    }
    
    private generateMecaStatiqueSection(config: MecaStatiqueConfig): string {
        let section = '\n# --- 10. Análise Estática Linear (MECA_STATIQUE) ---\n'
        
        // Build EXCIT list
        const excitList = config.excit.map(excit => {
            let excitStr = `_F(\n    CHARGE=${excit.charge}`
            if (excit.fonc_mult) {
                excitStr += `,\n    FONC_MULT=${excit.fonc_mult}`
            }
            excitStr += '\n)'
            return excitStr
        }).join(',\n        ')
        
        // Build MECA_STATIQUE command
        section += `RESU = MECA_STATIQUE(
    MODELE=${config.modele},
    CHAM_MATER=${config.cham_mater}`
        
        if (config.cara_elem) {
            section += `,\n    CARA_ELEM=${config.cara_elem}`
        }
        
        section += `,
    EXCIT = (
        ${excitList}
    ),
    INST=${config.inst || 0.0},
    OPTION='${config.option || 'SIEF_ELGA'}',
    INFO=${config.info || 1},
    SOLVEUR = (
        METHODE='MUMPS',
        ELIM_LAGR='LAGR2',
        RESI_RELA=1e-06,
        STOP_SINGULIER='OUI'
    )
);`
        
        return section
    }
    
    private generatePostProcessingSection(postProcessingConfig?: any): string {
        let section = '\n# --- 11. Pós-Processamento ---\n'
        
        // Mass calculation
        if (postProcessingConfig?.mass_calculations?.length > 0) {
            section += '# --- 11.1 Cálculo de Massa ---\n'
            postProcessingConfig.mass_calculations.forEach((calc: any) => {
                section += `${calc.command}\n`
            })
        }
        
        // Reaction extraction
        if (postProcessingConfig?.reaction_cases?.length > 0) {
            section += '\n# --- 11.2 Extração de Reações ---\n'
            postProcessingConfig.reaction_cases.forEach((reaction: any) => {
                section += `${reaction.command}\n`
            })
        }
        
        return section
    }
    
    // --- Helper Methods ---
    
    private buildExcitList(loadCommands: LoadCommands, restrictionCommands: RestrictionCommands): Array<{charge: string, fonc_mult?: string}> {
        const excitList: Array<{charge: string, fonc_mult?: string}> = []
        
        // Add restriction charges
        restrictionCommands.ddlCommands.forEach(cmd => {
            const match = cmd.match(/(\w+)\s*=\s*AFFE_CHAR_MECA/)
            if (match) {
                excitList.push({ charge: match[1] })
            }
        })
        
        // Add load charges
        if (loadCommands.totalLoadName) {
            excitList.push({ charge: loadCommands.totalLoadName })
        }
        
        // Add individual load charges if no total
        [...loadCommands.gravityCommands, ...loadCommands.forceCommands, ...loadCommands.pressureCommands].forEach(cmd => {
            const match = cmd.match(/(\w+)\s*=\s*AFFE_CHAR_MECA/)
            if (match) {
                excitList.push({ charge: match[1] })
            }
        })
        
        return excitList
    }
    
    private assembleFullComm(sections: {
        meshSection: string
        modelSection: string
        materialSection: string
        loadSection: string
        restrictionSection: string
        mecaStatiqueSection: string
        postProcessingSection: string
    }): string {
        return `DEBUT(LANG='FR')

${sections.meshSection}

${sections.modelSection}

${sections.materialSection}

${sections.restrictionSection}

${sections.loadSection}

${sections.mecaStatiqueSection}

${sections.postProcessingSection}

FIN()`
    }
    
}

// Export singleton instance
export const commOrchestrator = CommOrchestrator.getInstance()
