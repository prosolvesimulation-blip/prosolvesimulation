/**
 * Dimensional Compatibility Matrix
 * 
 * Determines which dimensional combinations are available based on contactPairs.json
 */

import type { ContactPairsData } from '../types/contact';

export interface CompatibilityMatrix {
  [key: string]: number[]; // dimension -> compatible dimensions
}

/**
 * Builds compatibility matrix from contact pairs data
 */
export function buildCompatibilityMatrix(contactPairsData: ContactPairsData): CompatibilityMatrix {
  const matrix: CompatibilityMatrix = {
    '1': [],
    '2': [],
    '3': []
  };

  // Extract all available dimensional combinations
  Object.keys(contactPairsData.contact_pairs).forEach(key => {
    if (key === 'description') return;

    const [dim1, dim2] = key.split('_').map(d => parseInt(d.replace('D', '')));
    
    if (dim1 && dim2 && dim1 >= 1 && dim1 <= 3 && dim2 >= 1 && dim2 <= 3) {
      // Add bidirectional compatibility
      if (!matrix[dim1.toString()].includes(dim2)) {
        matrix[dim1.toString()].push(dim2);
      }
      if (!matrix[dim2.toString()].includes(dim1)) {
        matrix[dim2.toString()].push(dim1);
      }
    }
  });

  return matrix;
}

/**
 * Gets compatible dimensions for a given dimension
 */
export function getCompatibleDimensions(
  dimension: number,
  contactPairsData: ContactPairsData
): number[] {
  const matrix = buildCompatibilityMatrix(contactPairsData);
  return matrix[dimension.toString()] || [];
}

/**
 * Checks if two dimensions are compatible
 */
export function areDimensionsCompatible(
  dim1: number,
  dim2: number,
  contactPairsData: ContactPairsData
): boolean {
  const compatibleDims = getCompatibleDimensions(dim1, contactPairsData);
  return compatibleDims.includes(dim2);
}

/**
 * Filters groups based on selected dimension and compatibility
 */
export function filterGroupsByDimension(
  groups: string[],
  selectedDimension: number,
  groupDimensions: Map<string, any>,
  contactPairsData: ContactPairsData
): string[] {
  const compatibleDimensions = getCompatibleDimensions(selectedDimension, contactPairsData);
  
  return groups.filter(group => {
    const groupDim = groupDimensions.get(group)?.dimension;
    return groupDim && compatibleDimensions.includes(groupDim);
  });
}
