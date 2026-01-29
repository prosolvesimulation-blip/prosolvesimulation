/**
 * Material Intelligence Module - Code_Aster Frontend Integration
 * Provides intelligent DEFI_MATERIAU and AFFE_MATERIAU command generation
 * with validation and real-time preview capabilities
 */

// --- Core Types and Interfaces ---

export interface MaterialProperties {
    E: number      // Young's Modulus (Pa)
    NU: number     // Poisson's Ratio
    RHO: number    // Density (kg/m³)
}

export interface MaterialDefinition {
    id: string
    name: string
    props: MaterialProperties
    assignedGroups: string[]
}

export interface MaterialAssignment {
    material: string
    groups: string[]
}

export interface MaterialValidationResult {
    isValid: boolean
    errors: string[]
    warnings: string[]
}

export interface MaterialCommandsResult {
    defiCommands: string[]
    affeCommands: string[]
    validation: MaterialValidationResult
    materialVariables: Record<string, string>
}

// --- Material Intelligence Class ---

export class MaterialIntelligence {
    private static instance: MaterialIntelligence
    
    private constructor() {}
    
    public static getInstance(): MaterialIntelligence {
        if (!MaterialIntelligence.instance) {
            MaterialIntelligence.instance = new MaterialIntelligence()
        }
        return MaterialIntelligence.instance
    }
    
    /**
     * Sanitize material name for Code_Aster variable naming
     * Converts "Steel S235" -> "M_STEEL_S235"
     */
    private sanitizeMaterialName(name: string): string {
        const cleanName = name.toUpperCase()
            .replace(/[^A-Z0-9_]/g, '_')  // Replace non-alphanumeric with underscore
            .replace(/_+/g, '_')           // Replace multiple underscores with single
            .replace(/^_+|_+$/g, '')       // Remove leading/trailing underscores
        return `M_${cleanName}`
    }
    
    /**
     * Validate material properties (disabled for free text fields)
     */
    private validateMaterialProperties(_props: MaterialProperties): MaterialValidationResult {
        // No validation - fields are free text
        return {
            isValid: true,
            errors: [],
            warnings: []
        }
    }
    
    /**
     * Validate material assignments
     */
    private validateMaterialAssignments(materials: MaterialDefinition[]): MaterialValidationResult {
        const errors: string[] = []
        const warnings: string[] = []
        
        // Check for duplicate material names
        const materialNames = materials.map(m => m.name.toLowerCase())
        const duplicates = materialNames.filter((name, index) => materialNames.indexOf(name) !== index)
        if (duplicates.length > 0) {
            errors.push(`Duplicate material names: ${duplicates.join(', ')}`)
        }
        
        // Check for empty material names
        const emptyNames = materials.filter(m => !m.name.trim())
        if (emptyNames.length > 0) {
            errors.push('Material names cannot be empty')
        }
        
        // Check for materials without assigned groups
        const unassignedMaterials = materials.filter(m => m.assignedGroups.length === 0)
        if (unassignedMaterials.length > 0) {
            warnings.push(`Materials without assigned groups: ${unassignedMaterials.map(m => m.name).join(', ')}`)
        }
        
        // Check for groups assigned to multiple materials
        const allAssignments = materials.flatMap(m => 
            m.assignedGroups.map(group => ({ group, material: m.name }))
        )
        const groupAssignments = new Map<string, string[]>()
        
        allAssignments.forEach(({ group, material }) => {
            if (!groupAssignments.has(group)) {
                groupAssignments.set(group, [])
            }
            groupAssignments.get(group)!.push(material)
        })
        
        const conflictedGroups = Array.from(groupAssignments.entries())
            .filter(([_, materials]) => materials.length > 1)
        
        if (conflictedGroups.length > 0) {
            errors.push('Groups assigned to multiple materials:')
            conflictedGroups.forEach(([group, materials]) => {
                errors.push(`  - ${group}: ${materials.join(', ')}`)
            })
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        }
    }
    
    /**
     * Generate DEFI_MATERIAU commands
     */
    private generateDefiMateriauCommands(materials: MaterialDefinition[]): string[] {
        const commands: string[] = []
        
        for (const material of materials) {
            const varName = this.sanitizeMaterialName(material.name)
            const { E, NU, RHO } = material.props
            
            const command = `${varName} = DEFI_MATERIAU(
    ELAS=_F(
        E=${E},
        NU=${NU},
        RHO=${RHO}
    )
);`
            
            commands.push(command)
        }
        
        return commands
    }
    
    /**
     * Generate AFFE_MATERIAU command
     */
    private generateAffeMateriauCommand(materials: MaterialDefinition[]): string {
        const assignments = materials
            .filter(m => m.assignedGroups.length > 0)
            .map(material => ({
                mater: this.sanitizeMaterialName(material.name),
                groups: material.assignedGroups
            }))
        
        if (assignments.length === 0) {
            return ''
        }
        
        const affeBlocks = assignments.map(item => {
            const groupsStr = item.groups.map(g => `'${g}'`).join(', ')
            return `        _F(
            GROUP_MA=(${groupsStr}),
            MATER=${item.mater}
        )`
        })
        
        const command = `CHAM_MATER = AFFE_MATERIAU(
    MODELE=MODELE,
    AFFE=(
${affeBlocks.join(',\n')},
    ),
);`
        
        return command
    }
    
    /**
     * Generate complete material commands for Code_Aster
     */
    public generateMaterialCommands(materials: MaterialDefinition[]): MaterialCommandsResult {
        // Validate materials
        const propertyValidations = materials.map(m => this.validateMaterialProperties(m.props))
        const assignmentValidation = this.validateMaterialAssignments(materials)
        
        // Combine all errors and warnings
        const allErrors = [
            ...propertyValidations.flatMap(v => v.errors),
            ...assignmentValidation.errors
        ]
        
        const allWarnings = [
            ...propertyValidations.flatMap(v => v.warnings),
            ...assignmentValidation.warnings
        ]
        
        const validation: MaterialValidationResult = {
            isValid: allErrors.length === 0,
            errors: allErrors,
            warnings: allWarnings
        }
        
        // Generate commands
        const defiCommands = this.generateDefiMateriauCommands(materials)
        const affeCommand = this.generateAffeMateriauCommand(materials)
        const affeCommands = affeCommand ? [affeCommand] : []
        
        // Create material variable mapping
        const materialVariables: Record<string, string> = {}
        materials.forEach(m => {
            materialVariables[m.name] = this.sanitizeMaterialName(m.name)
        })
        
        return {
            defiCommands,
            affeCommands,
            validation,
            materialVariables
        }
    }
    
    /**
     * Get material property validation hints
     */
    public getValidationHints(): Record<string, string[]> {
        return {
            E: [
                'Young\'s Modulus must be positive',
                'Typical range: 1000 to 500000 (MPa scale)',
                'Steel: ~210000, Aluminum: ~70000, Concrete: ~32000'
            ],
            NU: [
                'Poisson\'s Ratio must be between -1 and 0.5',
                'Typical range: 0 to 0.45 for most materials',
                'Steel: ~0.3, Aluminum: ~0.33, Concrete: ~0.2'
            ],
            RHO: [
                'Density must be positive (kg/m³)',
                'Typical range: 100 to 50000 kg/m³',
                'Steel: ~7850, Aluminum: ~2700, Concrete: ~2400'
            ],
            assignments: [
                'Each group should be assigned to only one material',
                'Materials without groups will not be included in AFFE_MATERIAU',
                'Material names must be unique'
            ]
        }
    }
    
    /**
     * Get material presets for common materials
     */
    public getMaterialPresets(): Record<string, MaterialProperties> {
        return {
            'Steel S235': { E: 210000, NU: 0.3, RHO: 7850 },
            'Steel S355': { E: 210000, NU: 0.3, RHO: 7850 },
            'Aluminum 6061': { E: 70000, NU: 0.33, RHO: 2710 },
            'Concrete C30': { E: 32000, NU: 0.2, RHO: 2400 },
            'Stainless Steel 304': { E: 193000, NU: 0.29, RHO: 8000 },
            'Titanium Grade 5': { E: 110000, NU: 0.34, RHO: 4430 },
            'Carbon Fiber': { E: 150000, NU: 0.3, RHO: 1600 },
            'Wood (Oak)': { E: 12000, NU: 0.35, RHO: 750 }
        }
    }
}

// Export singleton instance
export const materialIntelligence = MaterialIntelligence.getInstance()
