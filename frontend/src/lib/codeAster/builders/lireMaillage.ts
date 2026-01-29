/**
 * LIRE_MAILLAGE and ASSE_MAILLAGE Intelligence Engine
 * Provides intelligent command generation and validation for mesh operations
 */

// --- Core Types ---

export interface MeshConfig {
    name: string
    filename: string
    format: 'MED' | 'ASTER'
    unit?: number
}

export interface AsseMaillageResult {
    mode: 'SINGLE' | 'ASSE'
    finalMesh: string
    resultName: string
    items: Array<{ mesh: string }>
    commands: string[]
}

export interface MeshValidationResult {
    isValid: boolean
    errors: string[]
    warnings: string[]
}

export interface MeshCommandsResult {
    lireCommands: string[]
    asseCommands: string[]
    validation: MeshValidationResult
    finalMeshName: string
}

// --- Mesh Intelligence Class ---

export class MeshIntelligence {
    private static instance: MeshIntelligence
    
    private constructor() {}
    
    public static getInstance(): MeshIntelligence {
        if (!MeshIntelligence.instance) {
            MeshIntelligence.instance = new MeshIntelligence()
        }
        return MeshIntelligence.instance
    }
    
    // --- Format Detection ---
    
    public detectFormat(filename: string): 'MED' | 'ASTER' {
        const ext = filename.toLowerCase().split('.').pop()
        return ext === 'med' ? 'MED' : 'ASTER'
    }
    
    // --- Mesh Processing ---
    
    public processMeshes(meshFiles: string[], unitStart: number = 20): MeshConfig[] {
        return meshFiles.map((filename, index) => ({
            name: filename.replace(/\.(med|aster)$/i, ''),
            filename,
            format: this.detectFormat(filename),
            unit: unitStart + index
        }))
    }
    
    // --- LIRE_MAILLAGE Command Generation ---
    
    public generateLireMaillage(mesh: MeshConfig): string {
        return `${mesh.name} = LIRE_MAILLAGE(
    UNITE=${mesh.unit},
    FORMAT='${mesh.format}',
    NOM_MED='${mesh.name}'
);`
    }
    
    public generateAllLireMaillage(meshes: MeshConfig[]): string[] {
        return meshes.map(mesh => this.generateLireMaillage(mesh))
    }
    
    // --- ASSE_MAILLAGE Command Generation ---
    
    public generateAsseMaillage(meshNames: string[], resultName: string = 'MAIL'): AsseMaillageResult {
        if (meshNames.length === 0) {
            throw new Error('No mesh names provided')
        }
        
        // Single mesh: no assembly needed
        if (meshNames.length === 1) {
            return {
                mode: 'SINGLE',
                finalMesh: meshNames[0],
                resultName: meshNames[0],
                items: [],
                commands: [`${resultName} = ${meshNames[0]};`]
            }
        }
        
        // Multiple meshes: need assembly
        const items = meshNames.map(name => ({ mesh: name }))
        const commands: string[] = []
        
        // Binary accumulation: mesh1 + mesh2 → result, result + mesh3 → result, etc.
        for (let i = 1; i < meshNames.length; i++) {
            const mesh1 = i === 1 ? meshNames[0] : resultName
            const mesh2 = meshNames[i]
            
            commands.push(`${resultName} = ASSE_MAILLAGE(
    MAILLAGE_1 = ${mesh1},
    MAILLAGE_2 = ${mesh2},
    OPERATION = 'SUPERPOSE',
);`)
        }
        
        return {
            mode: 'ASSE',
            finalMesh: resultName,
            resultName,
            items,
            commands
        }
    }
    
    // --- Complete Mesh Command Generation ---
    
    public generateMeshCommands(meshFiles: string[], unitStart: number = 20): MeshCommandsResult {
        // Process meshes
        const meshes = this.processMeshes(meshFiles, unitStart)
        
        // Generate LIRE_MAILLAGE commands
        const lireCommands = this.generateAllLireMaillage(meshes)
        
        // Generate ASSE_MAILLAGE commands
        const meshNames = meshes.map(m => m.name)
        const asseResult = this.generateAsseMaillage(meshNames)
        
        // Validate
        const validation = this.validateMeshes(meshes)
        
        return {
            lireCommands,
            asseCommands: asseResult.commands,
            validation,
            finalMeshName: asseResult.finalMesh
        }
    }
    
    // --- Validation ---
    
    public validateMeshes(meshes: MeshConfig[]): MeshValidationResult {
        const errors: string[] = []
        const warnings: string[] = []
        
        if (!meshes || meshes.length === 0) {
            errors.push('At least one mesh file is required')
            return { isValid: false, errors, warnings }
        }
        
        // Check for duplicate names
        const names = meshes.map(m => m.name)
        const duplicates = names.filter((name, index) => names.indexOf(name) !== index)
        if (duplicates.length > 0) {
            errors.push(`Duplicate mesh names: ${duplicates.join(', ')}`)
        }
        
        // Check for duplicate units
        const units = meshes.map(m => m.unit).filter(u => u !== undefined)
        const unitDuplicates = units.filter((unit, index) => units.indexOf(unit) !== index)
        if (unitDuplicates.length > 0) {
            errors.push(`Unit conflicts: ${unitDuplicates.join(', ')}`)
        }
        
        // Validate each mesh
        meshes.forEach((mesh, index) => {
            if (!mesh.name || mesh.name.trim() === '') {
                errors.push(`Mesh ${index + 1}: Name is required`)
            }
            
            if (!mesh.filename || mesh.filename.trim() === '') {
                errors.push(`Mesh ${index + 1}: Filename is required`)
            }
            
            if (!['MED', 'ASTER'].includes(mesh.format)) {
                errors.push(`Mesh ${mesh.name}: Invalid format '${mesh.format}'. Must be MED or ASTER`)
            }
            
            if (mesh.unit && (mesh.unit < 20 || mesh.unit > 99)) {
                warnings.push(`Mesh ${mesh.name}: Unit ${mesh.unit} is outside recommended range (20-99)`)
            }
        })
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        }
    }
    
    // --- Command Preview ---
    
    public generateCommPreview(meshFiles: string[], unitStart: number = 20): string {
        const result = this.generateMeshCommands(meshFiles, unitStart)
        
        let preview = '# --- 1. Leitura ---\n'
        preview += result.lireCommands.join('\n\n') + '\n\n'
        
        preview += '# --- 2. Assembly ---\n'
        if (result.validation.isValid) {
            preview += result.asseCommands.join('\n\n') + '\n'
        } else {
            preview += '# ERROR: Invalid mesh configuration\n'
        }
        
        return preview
    }
}

// Export singleton instance
export const meshIntelligence = MeshIntelligence.getInstance()
