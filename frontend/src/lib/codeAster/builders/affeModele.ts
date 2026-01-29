/**
 * Code_Aster AFFE_MODELE Intelligence Module
 * Generates AFFE_MODELE commands with validation and preview
 */

export interface ModelAssignment {
    group: string
    modelisation: string
    phenomenene: string
}

export interface ValidationResult {
    isValid: boolean
    errors: string[]
    warnings: string[]
}

export interface ModelCommandsResult {
    commands: ModelAssignment[]
    validation: ValidationResult
    finalModelName: string
}

class ModelIntelligence {
    /**
     * Validates model assignment parameters
     */
    private validateModelAssignment(assignments: ModelAssignment[]): ValidationResult {
        const errors: string[] = []
        const warnings: string[] = []

        // Check if assignments array is empty
        if (assignments.length === 0) {
            errors.push('No model assignments provided')
            return { isValid: false, errors, warnings }
        }

        // Check for duplicate groups
        const groupNames = assignments.map(a => a.group)
        const duplicateGroups = groupNames.filter((group, index) => groupNames.indexOf(group) !== index)
        if (duplicateGroups.length > 0) {
            errors.push(`Duplicate group assignments: ${duplicateGroups.join(', ')}`)
        }

        // Validate each assignment
        assignments.forEach((assignment, index) => {
            const assignmentNum = index + 1

            // Validate group name
            if (!assignment.group || assignment.group.trim() === '') {
                errors.push(`Assignment ${assignmentNum}: Group name is required`)
            } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(assignment.group)) {
                errors.push(`Assignment ${assignmentNum}: Invalid group name '${assignment.group}'. Must start with letter or underscore, contain only letters, numbers, underscores`)
            }

            // Validate modelisation
            if (!assignment.modelisation || assignment.modelisation.trim() === '') {
                errors.push(`Assignment ${assignmentNum}: Modelisation is required`)
            } else {
                const validModelisations = [
                    '3D', '3D_SI', '3D_IN',
                    'DKT', 'DST', 'COQUE_3D', 'MEMBRANE',
                    'POU_D_T', 'POU_D_E', 'BARRE', 'CABLE',
                    'C_PLAN', 'D_PLAN', 'AXIS'
                ]
                if (!validModelisations.includes(assignment.modelisation)) {
                    errors.push(`Assignment ${assignmentNum}: Invalid modelisation '${assignment.modelisation}'. Valid options: ${validModelisations.join(', ')}`)
                }
            }

            // Validate phenomenene
            if (!assignment.phenomenene || assignment.phenomenene.trim() === '') {
                errors.push(`Assignment ${assignmentNum}: Phenomenene is required`)
            } else {
                const validPhenomenenes = ['MECANIQUE', 'THERMIQUE', 'ACOUSTIQUE']
                if (!validPhenomenenes.includes(assignment.phenomenene)) {
                    errors.push(`Assignment ${assignmentNum}: Invalid phenomenene '${assignment.phenomenene}'. Valid options: ${validPhenomenenes.join(', ')}`)
                }
            }

            // Physics-model compatibility warnings
            if (assignment.phenomenene === 'THERMIQUE') {
                const thermalModels = ['C_PLAN', 'D_PLAN', 'AXIS', '3D']
                if (!thermalModels.includes(assignment.modelisation)) {
                    warnings.push(`Assignment ${assignmentNum}: Modelisation '${assignment.modelisation}' may not be compatible with THERMIQUE physics`)
                }
            }

            if (assignment.phenomenene === 'ACOUSTIQUE') {
                const acousticModels = ['3D', 'C_PLAN', 'D_PLAN']
                if (!acousticModels.includes(assignment.modelisation)) {
                    warnings.push(`Assignment ${assignmentNum}: Modelisation '${assignment.modelisation}' may not be compatible with ACOUSTIQUE physics`)
                }
            }
        })

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        }
    }

    /**
     * Generates model assignments from export data
     */
    generateModelAssignments(exportData: any[]): ModelAssignment[] {
        return exportData.map(item => ({
            group: item.group || '',
            modelisation: item.type || item.modelisation || '3D',
            phenomenene: item.phenomenon || item.phenomenene || 'MECANIQUE'
        }))
    }

    /**
     * Generates AFFE_MODELE commands with validation
     */
    generateModelCommands(exportData: any[], _meshName: string = 'MAIL', resultName: string = 'MODELE'): ModelCommandsResult {
        const assignments = this.generateModelAssignments(exportData)
        const validation = this.validateModelAssignment(assignments)

        return {
            commands: assignments,
            validation,
            finalModelName: resultName
        }
    }

    /**
     * Generates complete .comm preview for AFFE_MODELE
     */
    generateCommPreview(exportData: any[], meshName: string = 'MAIL', resultName: string = 'MODELE'): string {
        const result = this.generateModelCommands(exportData, meshName, resultName)
        
        if (!result.validation.isValid) {
            return `# Validation Errors:\n${result.validation.errors.map(error => `# ${error}`).join('\n')}`
        }

        if (result.commands.length === 0) {
            return '# No model assignments to generate'
        }

        let comm = `# --- 3. Model Assignment ---\n`
        comm += `${resultName} = AFFE_MODELE(\n`
        comm += `    MAILLAGE=${meshName},\n`
        comm += `    AFFE=(\n`

        result.commands.forEach((command, index) => {
            const isLast = index === result.commands.length - 1
            comm += `        _F(GROUP_MA='${command.group}', PHENOMENE='${command.phenomenene}', MODELISATION='${command.modelisation}')${isLast ? '' : ','}\n`
        })

        comm += `    ),\n`
        comm += `);\n`

        // Add warnings if any
        if (result.validation.warnings.length > 0) {
            comm += `\n# Warnings:\n`
            result.validation.warnings.forEach(warning => {
                comm += `# ${warning}\n`
            })
        }

        return comm
    }

    /**
     * Validates a single model assignment
     */
    validateSingleAssignment(group: string, modelisation: string, phenomenene: string): ValidationResult {
        return this.validateModelAssignment([{ group, modelisation, phenomenene }])
    }

    /**
     * Gets compatible modelisations for a given phenomenene
     */
    getCompatibleModelisations(phenomenene: string): string[] {
        const compatibility: Record<string, string[]> = {
            'MECANIQUE': [
                '3D', '3D_SI', '3D_IN',
                'DKT', 'DST', 'COQUE_3D', 'MEMBRANE',
                'POU_D_T', 'POU_D_E', 'BARRE', 'CABLE'
            ],
            'THERMIQUE': [
                'C_PLAN', 'D_PLAN', 'AXIS', '3D'
            ],
            'ACOUSTIQUE': [
                '3D', 'C_PLAN', 'D_PLAN'
            ]
        }

        return compatibility[phenomenene] || compatibility['MECANIQUE']
    }

    /**
     * Gets modelisation description
     */
    getModelisationDescription(modelisation: string): string {
        const descriptions: Record<string, string> = {
            '3D': '3D Solid Elements - Standard 3D mechanical analysis',
            '3D_SI': '3D Solid Elements - Small strain formulation',
            '3D_IN': '3D Solid Elements - Large strain formulation',
            'DKT': 'Kirchhoff-Love Discrete Shell Theory - Thin shells',
            'DST': 'Discrete Shear Theory - Thick shells',
            'COQUE_3D': '3D Shell Elements - General shell analysis',
            'MEMBRANE': 'Membrane Elements - In-plane loads only',
            'POU_D_T': 'Timoshenko Beam Theory - Shear deformation included',
            'POU_D_E': 'Euler-Bernoulli Beam Theory - No shear deformation',
            'BARRE': 'Bar Elements - Axial loads only',
            'CABLE': 'Cable Elements - Tension-only elements',
            'C_PLAN': 'Plane Strain - 2D thermal/mechanical analysis',
            'D_PLAN': 'Plane Stress - 2D thermal/mechanical analysis',
            'AXIS': 'Axisymmetric - Axisymmetric thermal/mechanical analysis'
        }

        return descriptions[modelisation] || 'Unknown modelisation'
    }
}

export const modelIntelligence = new ModelIntelligence()
