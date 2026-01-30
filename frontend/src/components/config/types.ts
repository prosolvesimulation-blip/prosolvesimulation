export type Category = '1D' | '2D' | '3D'
export type ExtendedCategory = Category | 'Node' | 'Point'
export type Physics = 'MECANIQUE' | 'THERMIQUE' | 'ACOUSTIQUE'

export interface MeshGroupInfo {
    count: number
    types: Record<string, number>
    category?: string
    med_type?: string
}

export interface MeshGroup {
    id: string
    name: string
    category: Category
    meshFile: string
    count: number
    composition: string
    selected: boolean
    physics: Physics
    elementType: string
    // Dados originais do meshGroups (fonte da verdade)
    originalTypes: Record<string, number>
    originalMedType?: string
}

export interface Geometry {
    group: string
    meshFile: string
    selected: boolean
    physics: Physics
    elementType: string
    category: Category
    count: number
    composition: string
    _category: Category
}

export interface ModelConfigProps {
    meshGroups: Record<string, Record<string, MeshGroupInfo>>
    onUpdate: (geometries: Geometry[]) => void
}
