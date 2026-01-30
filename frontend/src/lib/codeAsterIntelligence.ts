/**
 * Code_Aster Intelligence Engine - Frontend Module
 * Provides intelligent command generation, validation, and parameter mapping
 * for AFFE_CHAR_MECA operations directly in the frontend
 */

// --- Core Types and Enums ---

export const LoadType = {
    FORCE_NODALE: 'FORCE_NODALE',
    FORCE_ARETE: 'FORCE_ARETE',
    FORCE_FACE: 'FORCE_FACE',
    PRES_REP: 'PRES_REP',
    PESANTEUR: 'PESANTEUR'
} as const

export type LoadType = typeof LoadType[keyof typeof LoadType]

export const MeshTopology = {
    NODE: 'NODE',
    WIRE: 'WIRE',
    SURFACE: 'SURFACE',
    VOLUME: 'VOLUME'
} as const

export type MeshTopology = typeof MeshTopology[keyof typeof MeshTopology]

export interface ParameterRule {
    name: string
    required: boolean
    typeHint: 'float' | 'vector3d' | 'string'
    minValue?: number
    maxValue?: number
    dependsOn?: string[]
    conflictsWith?: string[]
    defaultValue?: any
    description?: string
    unit?: string
}

export interface LoadDefinition {
    loadType: LoadType
    label: string
    description: string
    allowedTopology: MeshTopology[]
    groupPrefix: 'GROUP_NO' | 'GROUP_MA'
    parameterRules: ParameterRule[]
    requiresModele: boolean
    optionalParams: string[]
    validationHints: string[]
    examples: string[]
}

export interface ValidationResult {
    isValid: boolean
    errors: string[]
    warnings: string[]
}

export interface CommandStructure {
    status: 'success' | 'error'
    loadType: string
    resultName: string
    command?: string
    parameters?: Record<string, any>
    errors?: string[]
}

export interface LoadParameters {
    [key: string]: number | number[] | string
}

// --- Code_Aster Intelligence Class ---

export class CodeAsterIntelligence {
    private static instance: CodeAsterIntelligence
    private loadDefinitions: Map<LoadType, LoadDefinition>

    private constructor() {
        this.loadDefinitions = this.initializeLoadDefinitions()
    }

    public static getInstance(): CodeAsterIntelligence {
        if (!CodeAsterIntelligence.instance) {
            CodeAsterIntelligence.instance = new CodeAsterIntelligence()
        }
        return CodeAsterIntelligence.instance
    }

    private initializeLoadDefinitions(): Map<LoadType, LoadDefinition> {
        const definitions = new Map<LoadType, LoadDefinition>()

        // FORCE_NODALE Definition
        definitions.set(LoadType.FORCE_NODALE, {
            loadType: LoadType.FORCE_NODALE,
            label: 'Nodal Force',
            description: 'Point loads on nodes (AFFE_CHAR_MECA/FORCE_NODALE)',
            allowedTopology: [MeshTopology.NODE],
            groupPrefix: 'GROUP_NO',
            parameterRules: [
                {
                    name: 'FX',
                    required: false,
                    typeHint: 'float',
                    description: 'Force component in X direction',
                    unit: 'N'
                },
                {
                    name: 'FY',
                    required: false,
                    typeHint: 'float',
                    description: 'Force component in Y direction',
                    unit: 'N'
                },
                {
                    name: 'FZ',
                    required: false,
                    typeHint: 'float',
                    description: 'Force component in Z direction',
                    unit: 'N'
                },
                {
                    name: 'MX',
                    required: false,
                    typeHint: 'float',
                    description: 'Moment component about X axis',
                    unit: 'N.m'
                },
                {
                    name: 'MY',
                    required: false,
                    typeHint: 'float',
                    description: 'Moment component about Y axis',
                    unit: 'N.m'
                },
                {
                    name: 'MZ',
                    required: false,
                    typeHint: 'float',
                    description: 'Moment component about Z axis',
                    unit: 'N.m'
                }
            ],
            requiresModele: true,
            optionalParams: ['DOUBLE_LAGRANGE', 'INFO', 'VERI_NORM', 'VERI_AFFE'],
            validationHints: [
                'At least one force component (FX, FY, FZ) is recommended',
                'Moments (MX, MY, MZ) only available for nodal forces',
                'Forces are applied at node locations'
            ],
            examples: [
                'FX = 1000.0',
                'FY = -500.0, FZ = 200.0',
                'FX = 1000.0, MY = 50.0'
            ]
        })

        // FORCE_ARETE Definition  
        definitions.set(LoadType.FORCE_ARETE, {
            loadType: LoadType.FORCE_ARETE,
            label: 'Edge Force',
            description: 'Linear load on edges (AFFE_CHAR_MECA/FORCE_ARETE)',
            allowedTopology: [MeshTopology.WIRE],
            groupPrefix: 'GROUP_MA',
            parameterRules: [
                {
                    name: 'FX',
                    required: false,
                    typeHint: 'float',
                    description: 'Linear force density in X direction',
                    unit: 'N/m'
                },
                {
                    name: 'FY',
                    required: false,
                    typeHint: 'float',
                    description: 'Linear force density in Y direction',
                    unit: 'N/m'
                },
                {
                    name: 'FZ',
                    required: false,
                    typeHint: 'float',
                    description: 'Linear force density in Z direction',
                    unit: 'N/m'
                },
                {
                    name: 'MX',
                    required: false,
                    typeHint: 'float',
                    description: 'Linear moment density about X axis',
                    unit: 'N·m/m'
                },
                {
                    name: 'MY',
                    required: false,
                    typeHint: 'float',
                    description: 'Linear moment density about Y axis',
                    unit: 'N·m/m'
                },
                {
                    name: 'MZ',
                    required: false,
                    typeHint: 'float',
                    description: 'Linear moment density about Z axis',
                    unit: 'N·m/m'
                }
            ],
            requiresModele: true,
            optionalParams: ['DOUBLE_LAGRANGE', 'INFO', 'VERI_NORM', 'VERI_AFFE'],
            validationHints: [
                'Forces are distributed per unit length (N/m)',
                'At least one force component recommended',
                'Applied to wire/edge elements'
            ],
            examples: [
                'FX = 100.0',
                'FY = -50.0, FZ = 25.0'
            ]
        })

        // FORCE_FACE Definition
        definitions.set(LoadType.FORCE_FACE, {
            loadType: LoadType.FORCE_FACE,
            label: 'Face Force',
            description: 'Surface traction vector (AFFE_CHAR_MECA/FORCE_FACE)',
            allowedTopology: [MeshTopology.SURFACE],
            groupPrefix: 'GROUP_MA',
            parameterRules: [
                {
                    name: 'FX',
                    required: false,
                    typeHint: 'float',
                    description: 'Surface traction in X direction',
                    unit: 'N/m²'
                },
                {
                    name: 'FY',
                    required: false,
                    typeHint: 'float',
                    description: 'Surface traction in Y direction',
                    unit: 'N/m²'
                },
                {
                    name: 'FZ',
                    required: false,
                    typeHint: 'float',
                    description: 'Surface traction in Z direction',
                    unit: 'N/m²'
                }
            ],
            requiresModele: true,
            optionalParams: ['DOUBLE_LAGRANGE', 'INFO', 'VERI_NORM', 'VERI_AFFE'],
            validationHints: [
                'Forces are distributed per unit area (N/m²)',
                'At least one force component recommended',
                'Applied to surface/face elements'
            ],
            examples: [
                'FZ = -1000.0',
                'FX = 500.0, FY = -300.0'
            ]
        })

        // PRES_REP Definition
        definitions.set(LoadType.PRES_REP, {
            loadType: LoadType.PRES_REP,
            label: 'Pressure',
            description: 'Normal pressure (AFFE_CHAR_MECA/PRES_REP)',
            allowedTopology: [MeshTopology.SURFACE, MeshTopology.VOLUME],
            groupPrefix: 'GROUP_MA',
            parameterRules: [
                {
                    name: 'PRES',
                    required: true,
                    typeHint: 'float',
                    minValue: 0,
                    description: 'Normal pressure magnitude',
                    unit: 'Pa',
                    defaultValue: 0
                }
            ],
            requiresModele: true,
            optionalParams: ['DOUBLE_LAGRANGE', 'INFO', 'VERI_NORM', 'VERI_AFFE'],
            validationHints: [
                'Pressure must be positive (Pa)',
                'Applied normal to surface (positive = into surface)',
                'Can be applied to surface or volume elements'
            ],
            examples: [
                'PRES = 101325.0',
                'PRES = 50000.0'
            ]
        })

        // PESANTEUR Definition
        definitions.set(LoadType.PESANTEUR, {
            loadType: LoadType.PESANTEUR,
            label: 'Gravity',
            description: 'Global acceleration field (AFFE_CHAR_MECA/PESANTEUR)',
            allowedTopology: [MeshTopology.VOLUME],
            groupPrefix: 'GROUP_MA',
            parameterRules: [
                {
                    name: 'GRAVITE',
                    required: true,
                    typeHint: 'float',
                    minValue: 0,
                    description: 'Gravitational acceleration magnitude',
                    unit: 'm/s²',
                    defaultValue: 9.81
                },
                {
                    name: 'DIRECTION',
                    required: true,
                    typeHint: 'vector3d',
                    description: 'Gravity direction vector',
                    defaultValue: [0, 0, -1]
                }
            ],
            requiresModele: true,
            optionalParams: ['GROUP_MA', 'DOUBLE_LAGRANGE', 'INFO', 'VERI_NORM', 'VERI_AFFE'],
            validationHints: [
                'Standard Earth gravity: 9.81 m/s²',
                'Direction (0,0,-1) for standard downward gravity',
                'GROUP_MA optional - if omitted, applies to entire model'
            ],
            examples: [
                'GRAVITE = 9.81, DIRECTION = (0, 0, -1)',
                'GRAVITE = 1.62, DIRECTION = (0, 0, -1)'
            ]
        })

        return definitions
    }

    // --- Public API Methods ---

    public validateLoadParameters(loadType: LoadType, parameters: LoadParameters): ValidationResult {
        const errors: string[] = []
        const warnings: string[] = []

        const definition = this.loadDefinitions.get(loadType)
        if (!definition) {
            errors.push(`Unknown load type: ${loadType}`)
            return { isValid: false, errors, warnings }
        }

        // Check required parameters
        for (const rule of definition.parameterRules) {
            if (rule.required && !(rule.name in parameters)) {
                errors.push(`Required parameter '${rule.name}' is missing`)
            } else if (rule.name in parameters) {
                const value = parameters[rule.name]

                // Type validation
                if (rule.typeHint === 'float') {
                    const numValue = Number(value)
                    if (isNaN(numValue)) {
                        errors.push(`${rule.name} must be a numeric value`)
                    } else {
                        parameters[rule.name] = numValue // Normalize to number

                        // Range validation
                        if (rule.minValue !== undefined && numValue < rule.minValue) {
                            errors.push(`${rule.name} must be >= ${rule.minValue}`)
                        }
                        if (rule.maxValue !== undefined && numValue > rule.maxValue) {
                            errors.push(`${rule.name} must be <= ${rule.maxValue}`)
                        }
                    }
                } else if (rule.typeHint === 'vector3d') {
                    if (Array.isArray(value) && value.length === 3) {
                        const validVector = value.every(v => !isNaN(Number(v)))
                        if (validVector) {
                            parameters[rule.name] = value.map(v => Number(v))
                        } else {
                            errors.push(`${rule.name} must be a 3-element numeric vector`)
                        }
                    } else {
                        errors.push(`${rule.name} must be a 3-element vector`)
                    }
                }
            }
        }

        // Load-specific validation
        if (loadType === LoadType.FORCE_NODALE || loadType === LoadType.FORCE_ARETE || loadType === LoadType.FORCE_FACE) {
            const hasForce = ['FX', 'FY', 'FZ'].some(param => param in parameters && parameters[param] !== 0)
            const hasMoment = ['MX', 'MY', 'MZ'].some(param => param in parameters && parameters[param] !== 0)

            if (!hasForce && !hasMoment) {
                warnings.push('No force or moment components specified. Load will have no effect.')
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        }
    }

    public generateCommandSyntax(
        loadType: LoadType,
        parameters: LoadParameters,
        targetGroup: string = '',
        resultName: string = 'load_1'
    ): CommandStructure {
        // Validate first
        const validation = this.validateLoadParameters(loadType, parameters)
        if (!validation.isValid) {
            return {
                status: 'error',
                loadType: loadType,
                resultName,
                errors: validation.errors
            }
        }

        const definition = this.loadDefinitions.get(loadType)!
        const args: string[] = []

        // Add MODELE (always required for AFFE_CHAR_MECA)
        args.push('MODELE = MODELE')

        // Add group specification
        if (targetGroup || loadType !== LoadType.PESANTEUR) {
            const groupKey = definition.groupPrefix
            args.push(`${groupKey} = '${targetGroup}'`)
        }

        // Add load-specific parameters
        const loadParams: string[] = []

        for (const rule of definition.parameterRules) {
            if (rule.name in parameters) {
                const value = parameters[rule.name]
                if (rule.typeHint === 'vector3d') {
                    const vectorValue = value as number[]
                    loadParams.push(`${rule.name} = (${vectorValue.join(', ')})`)
                } else {
                    loadParams.push(`${rule.name} = ${value}`)
                }
            }
        }

        // Add the load block
        if (loadParams.length > 0) {
            args.push(`${loadType} = _F(\n    ${loadParams.join(',\n    ')}\n)`)
        }

        // Add optional AFFE_CHAR_MECA parameters from the parameters object
        const optionalParams = {
            'DOUBLE_LAGRANGE': parameters.DOUBLE_LAGRANGE || '\'NON\'',
            'INFO': parameters.INFO !== undefined ? parameters.INFO : 1,
            'VERI_NORM': parameters.VERI_NORM || '\'NON\'',
            'VERI_AFFE': parameters.VERI_AFFE || '\'NON\''
        }

        // Only add optional parameters that are different from defaults or explicitly set
        if (optionalParams.DOUBLE_LAGRANGE !== '\'NON\'') {
            args.push(`DOUBLE_LAGRANGE = ${optionalParams.DOUBLE_LAGRANGE}`)
        }
        if (optionalParams.INFO !== 1) {
            args.push(`INFO = ${optionalParams.INFO}`)
        }
        if (optionalParams.VERI_NORM !== '\'NON\'') {
            args.push(`VERI_NORM = ${optionalParams.VERI_NORM}`)
        }
        if (optionalParams.VERI_AFFE !== '\'NON\'') {
            args.push(`VERI_AFFE = ${optionalParams.VERI_AFFE}`)
        }

        // Generate final command
        const command = `${resultName} = AFFE_CHAR_MECA(\n    ${args.join(',\n    ')}\n);`

        return {
            status: 'success',
            loadType: loadType,
            resultName,
            command,
            parameters: {
                ...parameters,
                targetGroup,
                resultName
            }
        }
    }

    public getLoadDefinition(loadType: LoadType): LoadDefinition | undefined {
        return this.loadDefinitions.get(loadType)
    }

    public getAllLoadDefinitions(): LoadDefinition[] {
        return Array.from(this.loadDefinitions.values())
    }

    public getValidationHints(loadType: LoadType): string[] {
        const definition = this.loadDefinitions.get(loadType)
        return definition?.validationHints || []
    }

    public getSyntaxHelp(): Record<string, any> {
        return {
            affe_char_meca: {
                description: 'Assign loads and boundary conditions to mechanical model',
                syntax: 'char_meca = AFFE_CHAR_MECA(MODELE = mo, ...)',
                common_parameters: {
                    'MODELE': 'Mechanical model (required)',
                    'DOUBLE_LAGRANGE': 'Double Lagrange method (\'OUI\'/\'NON\')',
                    'INFO': 'Information level (1/2)',
                    'VERI_NORM': 'Normal verification (\'OUI\'/\'NO\')',
                    'VERI_AFFE': 'Assignment verification (\'OUI\'/\'NO\')'
                },
                load_types: {
                    'FORCE_NODALE': 'Point loads on nodes',
                    'FORCE_ARETE': 'Linear loads on edges',
                    'FORCE_FACE': 'Surface traction on faces',
                    'PRES_REP': 'Normal pressure',
                    'PESANTEUR': 'Gravity field'
                }
            }
        }
    }
}

// Export singleton instance
export const codeAsterIntelligence = CodeAsterIntelligence.getInstance()
