/**
 * Geometry Intelligence Module
 * Generates Code_Aster AFFE_MODELE and AFFE_CARA_ELEM commands
 * Synchronizes with sectionproperties calculation completion
 */

interface Geometry {
    group: string
    _category: '1D' | '2D'
    section_type: 'BEAM' | 'SHELL'
    profile_type?: string
    section_params?: Record<string, any>
    section_properties?: Record<string, any>
}

interface CaraItem {
    type: 'POUTRE' | 'COQUE'
    group: string
    section?: string
    cara?: string
    vale?: string
    epais?: number
    excentrement?: number
    vecteur?: string
}

interface ValidationResult {
    isValid: boolean
    errors: string[]
    warnings: string[]
}

interface GeometryCommandsResult {
    modeleCommands: string[]
    caraCommands: string[]
    validation: ValidationResult
    summary: {
        totalGeometries: number
        beams: number
        shells: number
        hasSectionProperties: boolean
        missingProperties: string[]
    }
}

export class GeometryIntelligence {

    /**
     * Generate complete geometry commands for Code_Aster
     */
    generateGeometryCommands(geometries: Geometry[]): GeometryCommandsResult {
        if (!geometries || geometries.length === 0) {
            return this.createEmptyResult()
        }

        const validation = this.validateGeometries(geometries)
        const caraItems = this.generateCaraItems(geometries)
        const caraCommands = this.renderCaraCommands(caraItems)
        const summary = this.generateSummary(geometries)

        return {
            modeleCommands: [], // Empty - Model Assignment handled elsewhere
            caraCommands,
            validation,
            summary
        }
    }

    /**
     * Check if section calculation is complete for all beam geometries
     */
    isSectionCalculationComplete(geometries: Geometry[]): boolean {
        return geometries.every(g =>
            g._category === '2D' || (g.section_properties && Object.keys(g.section_properties).length > 0)
        )
    }

    /**
     * Validate geometry configuration
     */
    private validateGeometries(geometries: Geometry[]): ValidationResult {
        const errors: string[] = []
        const warnings: string[] = []

        // Check for required section properties in beams
        const beamsWithoutProperties = geometries.filter(g =>
            g._category === '1D' && (!g.section_properties || Object.keys(g.section_properties).length === 0)
        )

        if (beamsWithoutProperties.length > 0) {
            errors.push(`Missing section properties for beams: ${beamsWithoutProperties.map(g => g.group).join(', ')}`)
        }

        // Check for duplicate groups
        const groupNames = geometries.map(g => g.group)
        const duplicates = groupNames.filter((name, index) => groupNames.indexOf(name) !== index)
        if (duplicates.length > 0) {
            errors.push(`Duplicate group names: ${[...new Set(duplicates)].join(', ')}`)
        }

        // Check for invalid categories
        const invalidCategories = geometries.filter(g => !['1D', '2D'].includes(g._category))
        if (invalidCategories.length > 0) {
            warnings.push(`Unknown categories for: ${invalidCategories.map(g => g.group).join(', ')}`)
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        }
    }

    /**
     * Generate element characteristics items
     */
    private generateCaraItems(geometries: Geometry[]): CaraItem[] {
        return geometries.map(geo => {
            if (geo._category === '2D') {
                return this.generateShellCaraItem(geo)
            } else {
                return this.generateBeamCaraItem(geo)
            }
        }).filter(Boolean) as CaraItem[]
    }

    /**
     * Generate shell element characteristics
     */
    private generateShellCaraItem(geo: Geometry): CaraItem {
        const params = geo.section_params || {}

        return {
            type: 'COQUE',
            group: geo.group,
            epais: params.thickness || 10.0,
            excentrement: params.offset || 0.0,
            vecteur: this.formatVector(params.vx || 1.0, params.vy || 0.0, params.vz || 0.0)
        }
    }

    /**
     * Generate beam element characteristics with section properties
     */
    private generateBeamCaraItem(geo: Geometry): CaraItem | null {
        const props = geo.section_properties
        if (!props) {
            return null
        }

        // Map sectionproperties to Code_Aster values
        const area = props["Area (A)"] || 1.0
        const iy = props["Iyy (Node 0,0)"] || 1.0  // Moment about Node Y
        const iz = props["Izz (Node 0,0)"] || 1.0  // Moment about Node Z
        const jx = props["Torsion J"] || 1.0
        const jg = props["Warping Iw"] || 0.0

        // Shear area calculations
        const as_y_ca = props["Shear Area Az"] || area
        const as_z_ca = props["Shear Area Ay"] || area
        const ay = as_y_ca > 0 ? area / as_y_ca : 1.0
        const az = as_z_ca > 0 ? area / as_z_ca : 1.0

        // Fiber distances from extents
        const ry = Math.max(Math.abs(props["Min Y"] || 0), Math.abs(props["Max Y"] || 0))
        const rz = Math.max(Math.abs(props["Min X"] || 0), Math.abs(props["Max X"] || 0))

        // Ensure minimum values to avoid division by zero
        const final_ry = Math.max(ry, 1.0e-3)
        const final_rz = Math.max(rz, 1.0e-3)

        return {
            type: 'POUTRE',
            group: geo.group,
            section: 'GENERALE',
            cara: "('A', 'IY', 'IZ', 'AY', 'AZ', 'JX', 'JG', 'RY', 'RZ')",
            vale: `(${area}, ${iy}, ${iz}, ${ay}, ${az}, ${jx}, ${jg}, ${final_ry}, ${final_rz})`
        }
    }

    /**
     * Render AFFE_CARA_ELEM commands
     */
    private renderCaraCommands(items: CaraItem[]): string[] {
        if (items.length === 0) return []

        const commands: string[] = []
        commands.push('# --- Element Characteristics ---')
        commands.push('CARA_ELEM = AFFE_CARA_ELEM(')
        commands.push('    MODELE = MODELE,')

        const coqueItems = items.filter(i => i.type === 'COQUE')
        const poutreItems = items.filter(i => i.type === 'POUTRE')

        if (coqueItems.length > 0) {
            if (coqueItems.length === 1) {
                commands.push('    COQUE = _F(')
                this.renderCoqueF(coqueItems[0], commands, '        ')
                commands.push('    ),')
            } else {
                commands.push('    COQUE = (')
                coqueItems.forEach((item, idx) => {
                    commands.push('        _F(')
                    this.renderCoqueF(item, commands, '            ')
                    commands.push(idx === coqueItems.length - 1 ? '        )' : '        ),')
                })
                commands.push('    ),')
            }
        }

        if (poutreItems.length > 0) {
            if (poutreItems.length === 1) {
                commands.push('    POUTRE = _F(')
                this.renderPoutreF(poutreItems[0], commands, '        ')
                commands.push('    ),')
            } else {
                commands.push('    POUTRE = (')
                poutreItems.forEach((item, idx) => {
                    commands.push('        _F(')
                    this.renderPoutreF(item, commands, '            ')
                    commands.push(idx === poutreItems.length - 1 ? '        )' : '        ),')
                })
                commands.push('    ),')
            }
        }

        commands.push(')')
        commands.push('')

        return commands
    }

    private renderCoqueF(item: CaraItem, commands: string[], indent: string) {
        commands.push(`${indent}GROUP_MA = '${item.group}',`)
        commands.push(`${indent}EPAIS = ${item.epais},`)
        commands.push(`${indent}EXCENTREMENT = ${item.excentrement},`)
        commands.push(`${indent}VECTEUR = ${item.vecteur},`)
        commands.push(`${indent}INER_ROTA = 'OUI',`)
    }

    private renderPoutreF(item: CaraItem, commands: string[], indent: string) {
        commands.push(`${indent}GROUP_MA = '${item.group}',`)
        commands.push(`${indent}SECTION = '${item.section}',`)
        commands.push(`${indent}CARA = ${item.cara},`)
        commands.push(`${indent}VALE = ${item.vale},`)
    }

    /**
     * Format vector for Code_Aster
     */
    private formatVector(vx: number, vy: number, vz: number): string {
        return `(${vx}, ${vy}, ${vz})`
    }

    /**
     * Generate summary information
     */
    private generateSummary(geometries: Geometry[]) {
        const beams = geometries.filter(g => g._category === '1D').length
        const shells = geometries.filter(g => g._category === '2D').length
        const beamsWithProperties = geometries.filter(g =>
            g._category === '1D' && g.section_properties
        ).length

        const missingProperties = geometries
            .filter(g => g._category === '1D' && !g.section_properties)
            .map(g => g.group)

        return {
            totalGeometries: geometries.length,
            beams,
            shells,
            hasSectionProperties: beamsWithProperties === beams,
            missingProperties
        }
    }

    /**
     * Create empty result for invalid input
     */
    private createEmptyResult(): GeometryCommandsResult {
        return {
            modeleCommands: [],
            caraCommands: [],
            validation: {
                isValid: false,
                errors: ['No geometries provided'],
                warnings: []
            },
            summary: {
                totalGeometries: 0,
                beams: 0,
                shells: 0,
                hasSectionProperties: false,
                missingProperties: []
            }
        }
    }
}

export const geometryIntelligence = new GeometryIntelligence()
