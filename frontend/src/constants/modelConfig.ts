/**
 * Model Configuration Constants
 */

export const FULL_MESH_PATTERNS = ['_FULL_MESH_', '_FULL_MESH'];

export const CATEGORY_CONFIG = {
    '1D': { color: 'blue', label: '1D Elements' },
    '2D': { color: 'green', label: '2D Elements' },
    '3D': { color: 'purple', label: '3D Elements' },
    'Node': { color: 'orange', label: 'Nodes' }
} as const;

export const BADGE_VARIANTS = {
    '1D': 'default',
    '2D': 'secondary', 
    '3D': 'outline',
    'Node': 'destructive'
} as const;

export const DEFAULT_PHENOMENE = 'MECANIQUE';

export const FORMULATION_LABELS: Record<string, string> = {
    'LINEAIRE': 'Linear',
    'QUADRATIQUE': 'Quadratic',
    'U_P_PHI': 'U-P-φ',
    'U_P': 'U-P',
    'U_PSI': 'U-ψ',
    'DIL': 'Dilatational',
    'DIL_INCO': 'Dilatational Incompressible'
};
