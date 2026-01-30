import type { Category, ExtendedCategory } from './types'
import { ELEMENT_TYPE_MAPPING } from './constants'

export const detectCategory = (types: Record<string, number>): ExtendedCategory => {
    if (!types || Object.keys(types).length === 0) return '3D'
    
    const typeKeys = Object.keys(types).map(k => k.toUpperCase())
    
    for (const [type, category] of Object.entries(ELEMENT_TYPE_MAPPING)) {
        if (typeKeys.includes(type.toUpperCase())) {
            return category
        }
    }
    
    return '3D'
}

export const detectDefaultModel = (category: Category): string => {
    switch (category) {
        case '1D': return 'POU_D_T'
        case '2D': return 'COQUE_3D'
        case '3D': return '3D'
        default: return '3D'
    }
}

export const createCompositionString = (types: Record<string, number>, fallback: string): string => {
    if (!types || Object.keys(types).length === 0) return fallback
    
    return Object.entries(types)
        .map(([type, quantity]) => `${type}:${quantity}`)
        .join(', ')
}

export const createGroupId = (meshFile: string, groupName: string): string => {
    return `${meshFile}_${groupName}`
}
