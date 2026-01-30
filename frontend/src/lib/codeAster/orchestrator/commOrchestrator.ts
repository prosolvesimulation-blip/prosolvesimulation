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
    geometrySection: string  // NEW
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

    private constructor() { }

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
        const loadCaseCommands = projectConfig.load_case_commands || []

        const postProcessingConfig = {
            mass_calculations: projectConfig.post_elem_mass?.mass_calculations || [],
            reaction_cases: projectConfig.post_releve_t_reactions?.reaction_cases || []
        }

        const geometryCommands = projectConfig.geometry_commands || { caraCommands: [], validation: { isValid: false } }

        // Generate individual sections
        const meshSection = this.generateMeshSection(meshCommands)
        const modelSection = this.generateModelSection(modelCommands)
        const geometrySection = this.generateGeometrySection(geometryCommands) // NEW
        const materialSection = this.generateMaterialSection(materialCommands)
        const loadSection = this.generateLoadSection(loadCommands)
        const restrictionSection = this.generateRestrictionSection(restrictionCommands)
        const mecaStatiqueSection = this.generateMecaStatiqueSection(loadCommands, restrictionCommands, loadCaseCommands, geometryCommands)
        const postProcessingSection = this.generatePostProcessingSection(postProcessingConfig)

        // Combine into full .comm file
        const fullCommFile = this.assembleFullComm({
            meshSection,
            modelSection,
            geometrySection, // NEW
            materialSection,
            loadSection,
            restrictionSection,
            mecaStatiqueSection,
            postProcessingSection
        })


        return {
            meshSection,
            modelSection,
            geometrySection, // NEW
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
        if (meshCommands.lireCommands.length === 0 && meshCommands.asseCommands.length === 0) {
            return ''
        }

        let section = '# --- 1. Leitura ---\n'
        meshCommands.lireCommands.forEach(cmd => {
            section += `${cmd}\n`
        })

        if (meshCommands.asseCommands.length > 0) {
            section += '\n# --- 2. Assembly ---\n'
            meshCommands.asseCommands.forEach(cmd => {
                section += `${cmd}\n`
            })
        }

        return section
    }

    private generateModelSection(modelCommands: ModelCommands): string {
        if (!modelCommands.commPreview) return ''
        let section = '\n# --- 3. Modelo ---\n'
        section += `${modelCommands.commPreview}\n`
        return section
    }

    private generateGeometrySection(geometryCommands: any): string {
        if (!geometryCommands?.caraCommands || geometryCommands.caraCommands.length === 0) {
            return ''
        }

        let section = '\n# --- 3.1 Características dos Elementos (Geometria) ---\n'
        geometryCommands.caraCommands.forEach((cmd: string) => {
            section += `${cmd}\n`
        })

        return section
    }

    private generateMaterialSection(materialCommands: MaterialCommands): string {
        if (materialCommands.defiCommands.length === 0 && materialCommands.affeCommands.length === 0) {
            return ''
        }

        let section = ''
        if (materialCommands.defiCommands.length > 0) {
            section += '\n# --- 4. Definição de Materiais ---\n'
            materialCommands.defiCommands.forEach(cmd => {
                section += `${cmd}\n`
            })
        }

        if (materialCommands.affeCommands.length > 0) {
            section += '\n# --- 5. Atribuição de Materiais ---\n'
            materialCommands.affeCommands.forEach(cmd => {
                section += `${cmd}\n`
            })
        }

        return section
    }

    private generateLoadSection(loadCommands: LoadCommands): string {
        const hasGravity = loadCommands.gravityCommands.length > 0
        const hasForce = loadCommands.forceCommands.length > 0
        const hasPressure = loadCommands.pressureCommands.length > 0

        if (!hasGravity && !hasForce && !hasPressure) return ''

        let section = '\n# --- 8. Carregamentos ---\n'

        if (hasGravity) {
            section += '# --- 8.1 Pesanteur ---\n'
            loadCommands.gravityCommands.forEach(cmd => {
                section += `${cmd}\n`
            })
        }

        if (hasForce) {
            section += (hasGravity ? '\n' : '') + '# --- 8.2 Forças Nodais ---\n'
            loadCommands.forceCommands.forEach(cmd => {
                section += `${cmd}\n`
            })
        }

        if (hasPressure) {
            section += (hasGravity || hasForce ? '\n' : '') + '# --- 8.3 Pressões ---\n'
            loadCommands.pressureCommands.forEach(cmd => {
                section += `${cmd}\n`
            })
        }

        return section
    }

    private generateRestrictionSection(restrictionCommands: RestrictionCommands): string {
        const hasDdl = restrictionCommands.ddlCommands.length > 0
        const hasFace = restrictionCommands.faceCommands.length > 0
        const hasEdge = restrictionCommands.edgeCommands.length > 0

        if (!hasDdl && !hasFace && !hasEdge) return ''

        let section = '\n# --- 7. Condições de Contorno ---\n'

        if (hasDdl) {
            section += '# --- 7.1 Condições de Contorno Nodais ---\n'
            restrictionCommands.ddlCommands.forEach(cmd => {
                section += `${cmd}\n`
            })
        }

        if (hasFace) {
            section += (hasDdl ? '\n' : '') + '# --- 7.2 Condições de Contorno de Face ---\n'
            restrictionCommands.faceCommands.forEach(cmd => {
                section += `${cmd}\n`
            })
        }

        if (hasEdge) {
            section += (hasDdl || hasFace ? '\n' : '') + '# --- 7.3 Condições de Contorno de Aresta ---\n'
            restrictionCommands.edgeCommands.forEach(cmd => {
                section += `${cmd}\n`
            })
        }

        return section
    }

    private generateMecaStatiqueSection(
        loadCommands: LoadCommands,
        restrictionCommands: RestrictionCommands,
        loadCaseCommands: any[] = [],
        geometryCommands?: any
    ): string {
        const hasCara = geometryCommands?.caraCommands && geometryCommands.caraCommands.length > 0
        const caraParam = hasCara ? '\n    CARA_ELEM=CARA_ELEM,' : ''

        const extractVar = (cmd: string) => {
            const match = cmd.match(/^(\w+)\s*=/)
            return match ? match[1] : null
        }

        const allRestrictionVars: string[] = []
        const restrictionSources = [
            restrictionCommands.ddlCommands,
            restrictionCommands.faceCommands,
            restrictionCommands.edgeCommands
        ]
        restrictionSources.forEach(source => {
            source.forEach(cmd => {
                const v = extractVar(cmd)
                if (v) allRestrictionVars.push(v)
            })
        })

        const allLoadVars: string[] = []
        const loadSources = [
            loadCommands.gravityCommands,
            loadCommands.forceCommands,
            loadCommands.pressureCommands
        ]
        loadSources.forEach(source => {
            source.forEach(cmd => {
                const v = extractVar(cmd)
                if (v) allLoadVars.push(v)
            })
        })

        // GUARD: If no load cases AND no fallback data, don't generate anything
        const hasLoadCases = loadCaseCommands && loadCaseCommands.length > 0
        const hasFallbackContent = allRestrictionVars.length > 0 || allLoadVars.length > 0

        if (!hasLoadCases && !hasFallbackContent) return ''

        let section = '\n# --- 10. Analysis (MECA_STATIQUE) ---\n'

        // Strategy A: Multi-Case Analysis
        if (hasLoadCases) {
            loadCaseCommands.forEach((lc, index) => {
                const resuName = `RESU_${index + 1}`
                section += `\n# Case: ${lc.name}\n`
                section += `${resuName} = MECA_STATIQUE(
    MODELE=MODELE,
    CHAM_MATER=CHAM_MATER,${caraParam}
    EXCIT=(`

                if (lc.restrictions?.length > 0) {
                    lc.restrictions.forEach((restName: string) => {
                        let varName = restName
                        const allRestCmds = restrictionSources.flat()
                        const matchCmd = allRestCmds.find(cmd => cmd.includes(`'${restName}'`) || cmd.includes(`"${restName}"`))
                        if (matchCmd) {
                            const match = matchCmd.match(/^(\w+)\s*=/)
                            if (match) varName = match[1]
                        }
                        section += `\n        _F(CHARGE=${varName}),`
                    })
                }

                if (lc.loads?.length > 0) {
                    lc.loads.forEach((loadName: string) => {
                        section += `\n        _F(CHARGE=${loadName}),`
                    })
                }

                section += `
    ),
    OPTION='SIEF_ELGA',
    SOLVEUR=_F(METHODE='MULT_FRONT',),
)\n`
            })
            return section
        }

        // Strategy B: Fallback
        section += `RESU = MECA_STATIQUE(
    MODELE=MODELE,
    CHAM_MATER=CHAM_MATER,${caraParam}
    EXCIT=(`

        allRestrictionVars.forEach(v => {
            section += `\n        _F(CHARGE=${v}),`
        })

        allLoadVars.forEach(v => {
            section += `\n        _F(CHARGE=${v}),`
        })

        section += `
    ),
    OPTION='SIEF_ELGA',
    SOLVEUR=_F(METHODE='MULT_FRONT',),
)\n`

        return section
    }

    private generatePostProcessingSection(postProcessingConfig?: any): string {
        const hasMass = postProcessingConfig?.mass_calculations?.length > 0
        const hasReactions = postProcessingConfig?.reaction_cases?.length > 0

        if (!hasMass && !hasReactions) return ''

        let section = '\n# --- 11. Pós-Processamento ---\n'

        if (hasMass) {
            section += '# --- 11.1 Cálculo de Massa ---\n'
            postProcessingConfig.mass_calculations.forEach((calc: any) => {
                section += `${calc.command}\n`
            })
        }

        if (hasReactions) {
            section += (hasMass ? '\n' : '') + '# --- 11.2 Extração de Reações ---\n'
            postProcessingConfig.reaction_cases.forEach((reaction: any) => {
                section += `${reaction.command}\n`
            })
        }

        return section
    }

    // --- Helper Methods ---


    private assembleFullComm(sections: {
        meshSection: string
        modelSection: string
        geometrySection: string
        materialSection: string
        loadSection: string
        restrictionSection: string
        mecaStatiqueSection: string
        postProcessingSection: string
    }): string {
        const activeSections = Object.values(sections).filter(s => s.trim() !== '')

        return `DEBUT(LANG='FR')\n
${activeSections.join('\n')}

FIN()`
    }

}

// Export singleton instance
export const commOrchestrator = CommOrchestrator.getInstance()
