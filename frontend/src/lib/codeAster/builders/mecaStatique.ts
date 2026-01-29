/**
 * MECA_STATIQUE Intelligence Engine
 * Implements Code_Aster MECA_STATIQUE command generation following official documentation
 */

// --- Core Types ---

export interface MecaStatiqueParameters {
    modele: string
    cham_mater: string
    cara_elem?: string
    excit: ExcitationItem[]
    inst?: number
    list_inst?: string
    inst_fin?: number
    option?: 'SIEF_ELGA' | 'SANS'
    info?: 1 | 2
    titre?: string
    resultName?: string
    solveur?: SolveurConfig
}

export interface ExcitationItem {
    charge: string
    fonc_mult?: string
}

export interface SolveurConfig {
    methode?: 'MUMPS' | 'MULT_FRONT' | 'LDLT' | 'GCPC'
    acceleration?: 'AUTO' | 'OUI' | 'NON'
    elim_lagr?: 'LAGR2' | 'LAGR3' | 'OUI' | 'NON'
    gestion_memoire?: 'AUTO' | 'OUI' | 'NON'
    low_rank_seuil?: number
    matr_distribuee?: 'OUI' | 'NON'
    nb_rhs?: number
    nprec?: number
    pcent_pivot?: number
    posttraitements?: 'AUTO' | 'OUI' | 'NON'
    pretraitements?: 'AUTO' | 'OUI' | 'NON'
    reduction_mpi?: number
    renum?: 'AUTO' | 'RCIL' | 'METIS' | 'SCOTCH' | 'OUI' | 'NON'
    resi_rela?: number
    stop_singulier?: 'OUI' | 'NON'
    type_resol?: 'AUTO' | 'DIRECT' | 'ITERatif'
}

export interface MecaStatiqueValidation {
    isValid: boolean
    errors: string[]
    warnings: string[]
}

export interface MecaStatiqueResult {
    command: string
    resultName: string
    validation: MecaStatiqueValidation
    summary: {
        totalExcitations: number
        hasCaraElem: boolean
        solveurMethod: string
        option: string
    }
}

// --- MECA_STATIQUE Intelligence Class ---

export class MecaStatiqueIntelligence {
    private static instance: MecaStatiqueIntelligence
    
    private constructor() {}
    
    public static getInstance(): MecaStatiqueIntelligence {
        if (!MecaStatiqueIntelligence.instance) {
            MecaStatiqueIntelligence.instance = new MecaStatiqueIntelligence()
        }
        return MecaStatiqueIntelligence.instance
    }
    
    /**
     * Generate MECA_STATIQUE command following Code_Aster documentation
     */
    public generateMecaStatique(params: MecaStatiqueParameters): MecaStatiqueResult {
        const validation = this.validateParameters(params)
        
        if (!validation.isValid) {
            return {
                command: '',
                resultName: '',
                validation,
                summary: {
                    totalExcitations: 0,
                    hasCaraElem: false,
                    solveurMethod: 'NONE',
                    option: 'NONE'
                }
            }
        }
        
        const command = this.buildCommand(params)
        const resultName = params.resultName || 'RESU_MECA'
        
        return {
            command,
            resultName,
            validation,
            summary: {
                totalExcitations: params.excit.length,
                hasCaraElem: !!params.cara_elem,
                solveurMethod: params.solveur?.methode || 'MUMPS',
                option: params.option || 'SIEF_ELGA'
            }
        }
    }
    
    /**
     * Validate MECA_STATIQUE parameters according to Code_Aster requirements
     */
    private validateParameters(params: MecaStatiqueParameters): MecaStatiqueValidation {
        const errors: string[] = []
        const warnings: string[] = []
        
        // Required parameters
        if (!params.modele) {
            errors.push('MODELE parameter is required')
        }
        
        if (!params.cham_mater) {
            errors.push('CHAM_MATER parameter is required')
        }
        
        if (!params.excit || params.excit.length === 0) {
            errors.push('At least one EXCIT item is required')
        } else {
            // Validate each excitation
            params.excit.forEach((excit, index) => {
                if (!excit.charge) {
                    errors.push(`EXCIT[${index}]: CHARGE parameter is required`)
                }
            })
        }
        
        // Optional parameter validation
        if (params.inst !== undefined && params.list_inst) {
            warnings.push('Both INST and LIST_INST specified - INST will be ignored')
        }
        
        if (params.inst_fin && !params.list_inst) {
            warnings.push('INST_FIN specified without LIST_INST - will be ignored')
        }
        
        // Solver validation
        if (params.solveur) {
            if (params.solveur.resi_rela && params.solveur.resi_rela <= 0) {
                warnings.push('RESI_RELA should be positive for convergence')
            }
            
            if (params.solveur.pcent_pivot && (params.solveur.pcent_pivot < 0 || params.solveur.pcent_pivot > 100)) {
                warnings.push('PCENT_PIVOT should be between 0 and 100')
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        }
    }
    
    /**
     * Build the MECA_STATIQUE command string
     */
    private buildCommand(params: MecaStatiqueParameters): string {
        const resultName = params.resultName || 'RESU_MECA'
        
        let command = `${resultName} = MECA_STATIQUE(\n`
        command += `    MODELE=${params.modele},\n`
        command += `    CHAM_MATER=${params.cham_mater}`
        
        // Optional CARA_ELEM
        if (params.cara_elem) {
            command += `,\n    CARA_ELEM=${params.cara_elem}`
        }
        
        // EXCIT block
        command += `,\n    EXCIT = (\n`
        command += this.buildExcitBlock(params.excit)
        command += `\n    )`
        
        // Time parameters
        if (params.list_inst) {
            command += `,\n    LIST_INST=${params.list_inst}`
            if (params.inst_fin) {
                command += `,\n    INST_FIN=${params.inst_fin}`
            }
        } else {
            command += `,\n    INST=${params.inst || 0.0}`
        }
        
        // Optional parameters
        if (params.option) {
            command += `,\n    OPTION='${params.option}'`
        }
        
        if (params.info) {
            command += `,\n    INFO=${params.info}`
        }
        
        if (params.titre) {
            command += `,\n    TITRE='${params.titre}'`
        }
        
        // Solver configuration
        if (params.solveur) {
            command += `,\n    SOLVEUR = (\n`
            command += this.buildSolverBlock(params.solveur)
            command += `\n    )`
        }
        
        command += `\n);`
        
        return command
    }
    
    /**
     * Build EXCIT block
     */
    private buildExcitBlock(excit: ExcitationItem[]): string {
        return excit.map(item => {
            let excitStr = `        _F(\n            CHARGE=${item.charge}`
            if (item.fonc_mult) {
                excitStr += `,\n            FONC_MULT=${item.fonc_mult}`
            }
            excitStr += `\n        )`
            return excitStr
        }).join(',\n')
    }
    
    /**
     * Build SOLVEUR block
     */
    private buildSolverBlock(solveur: SolveurConfig): string {
        const solverLines: string[] = []
        
        // Core solver method
        if (solveur.methode) {
            solverLines.push(`        METHODE='${solveur.methode}'`)
        }
        
        // Optional solver parameters
        const optionalParams: (keyof SolveurConfig)[] = [
            'acceleration', 'elim_lagr', 'gestion_memoire', 'low_rank_seuil',
            'matr_distribuee', 'nb_rhs', 'nprec', 'pcent_pivot',
            'posttraitements', 'pretraitements', 'reduction_mpi',
            'renum', 'resi_rela', 'stop_singulier', 'type_resol'
        ]
        
        optionalParams.forEach(param => {
            const value = solveur[param]
            if (value !== undefined) {
                if (typeof value === 'string') {
                    solverLines.push(`        ${param.toUpperCase()}='${value}'`)
                } else {
                    solverLines.push(`        ${param.toUpperCase()}=${value}`)
                }
            }
        })
        
        return solverLines.join(',\n')
    }
    
    /**
     * Create default solver configuration
     */
    public createDefaultSolver(): SolveurConfig {
        return {
            methode: 'MUMPS',
            acceleration: 'AUTO',
            elim_lagr: 'LAGR2',
            gestion_memoire: 'AUTO',
            low_rank_seuil: 0.0,
            matr_distribuee: 'NON',
            nb_rhs: 1,
            nprec: 8,
            pcent_pivot: 35,
            posttraitements: 'AUTO',
            pretraitements: 'AUTO',
            reduction_mpi: 0,
            renum: 'AUTO',
            resi_rela: 1e-06,
            stop_singulier: 'OUI',
            type_resol: 'AUTO'
        }
    }
    
    /**
     * Create excitation items from charge names
     */
    public createExcitations(chargeNames: string[]): ExcitationItem[] {
        return chargeNames.map(name => ({
            charge: name
        }))
    }
    
    /**
     * Generate MECA_STATIQUE for multiple load cases
     */
    public generateMultipleLoadCases(params: {
        baseParameters: Omit<MecaStatiqueParameters, 'excit'>
        loadCases: Array<{
            name: string
            charges: string[]
            inst?: number
        }>
    }): MecaStatiqueResult[] {
        return params.loadCases.map(loadCase => {
            return this.generateMecaStatique({
                ...params.baseParameters,
                excit: this.createExcitations(loadCase.charges),
                inst: loadCase.inst,
                resultName: `RESU_${loadCase.name.toUpperCase()}`
            })
        })
    }
    
    /**
     * Get command summary for UI display
     */
    public getCommandSummary(result: MecaStatiqueResult): string {
        if (!result.validation.isValid) {
            return 'Invalid configuration'
        }
        
        const summary = []
        summary.push(`${result.summary.totalExcitations} load(s)`)
        
        if (result.summary.hasCaraElem) {
            summary.push('with element properties')
        }
        
        summary.push(`Solver: ${result.summary.solveurMethod}`)
        summary.push(`Output: ${result.summary.option}`)
        
        return summary.join(' • ')
    }
}

// Export singleton instance
export const mecaStatiqueIntelligence = MecaStatiqueIntelligence.getInstance()
