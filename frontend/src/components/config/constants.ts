import type { Category, Physics } from './types'

export const CATEGORY_CONFIG = {
  '1D': {
    color: 'orange',
    label: '1D Elements',
    description: 'Beams & Bars',
    elementTypes: ['POU_D_T', 'POU_D_E', 'BARRE', 'CABLE'] as const
  },
  '2D': {
    color: 'cyan',
    label: '2D Elements', 
    description: 'Shells & Plates',
    elementTypes: ['COQUE_3D', 'DKT', 'DST', 'MEMBRANE'] as const
  },
  '3D': {
    color: 'emerald',
    label: '3D Elements',
    description: 'Solids & Volumes', 
    elementTypes: ['3D', '3D_D', '3D_SI'] as const
  }
} as const

export const PHYSICS_OPTIONS: Physics[] = ['MECANIQUE', 'THERMIQUE', 'ACOUSTIQUE']

export const ELEMENT_TYPE_MAPPING = {
  'SEG2': '1D' as Category,
  'SEG3': '1D' as Category,
  'TRIA3': '2D' as Category,
  'TRIA6': '2D' as Category,
  'TRIA7': '2D' as Category,
  'QUAD4': '2D' as Category,
  'QUAD8': '2D' as Category,
  'QUAD9': '2D' as Category,
  'HEXA8': '3D' as Category,
  'HEXA20': '3D' as Category,
  'TETRA4': '3D' as Category,
  'TETRA10': '3D' as Category,
  'PENTA6': '3D' as Category,
  'PENTA15': '3D' as Category
} as const
