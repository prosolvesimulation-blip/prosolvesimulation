/**
 * Contact Intelligence Engine
 * 
 * Core logic for dimensional analysis, contact filtering, and parameter processing
 * for the ProSolve contact tab intelligence system.
 */

import type { 
  ContactPair, 
  ContactPairsData, 
  GroupDimension, 
  ParameterField
} from '../types/contact';
import { isValidContactPairsData } from '../types/contact';

// Dimensional detection patterns based on common naming conventions
const DIMENSION_PATTERNS = {
  '1D': ['node', 'beam', 'pipe', 'truss', 'line', 'edge_1d'],
  '2D': ['edge', 'shell', 'face_2d', 'axisym', 'surface_2d', 'boundary_2d'],
  '3D': ['face', 'surface', 'solid', 'volume', 'boundary', 'body']
} as const;

// Parameter type inference patterns
const PARAMETER_PATTERNS = {
  number: [
    /coefficient/i,
    /stiffness/i,
    /friction/i,
    /thickness/i,
    /value/i,
    /e_[nt]/i,  // E_N, E_T (normal/tangential stiffness)
    /coulomb/i
  ],
  boolean: [
    /oui|non/i,
    /yes|no/i,
    /true|false/i
  ]
} as const;

/**
 * Detects the dimension (1D, 2D, or 3D) of a group based on its name
 */
export function detectGroupDimension(groupName: string): GroupDimension {
  const lowerName = groupName.toLowerCase();
  
  // Count matches for each dimension
  const scores = {
    1: 0,
    2: 0,
    3: 0
  };

  // Score based on pattern matches
  Object.entries(DIMENSION_PATTERNS).forEach(([dim, patterns]) => {
    const dimension = parseInt(dim) as 1 | 2 | 3;
    patterns.forEach(pattern => {
      if (lowerName.includes(pattern)) {
        scores[dimension] += 1;
      }
    });
  });

  // Find dimension with highest score
  let bestDimension = 1;
  let maxScore = scores[1];
  
  if (scores[2] > maxScore) {
    bestDimension = 2;
    maxScore = scores[2];
  }
  
  if (scores[3] > maxScore) {
    bestDimension = 3;
    maxScore = scores[3];
  }

  // Calculate confidence (0-1)
  const totalScore = scores[1] + scores[2] + scores[3];
  const confidence = totalScore > 0 ? maxScore / totalScore : 0.1; // Minimum confidence

  return {
    groupName,
    dimension: bestDimension as 1 | 2 | 3,
    confidence: Math.min(confidence, 1.0)
  };
}

/**
 * Generates the canonical key for contact pair lookup
 * Format: LowerDim_HigherDim (e.g., 1D_2D, 2D_3D)
 */
export function generateContactKey(masterDim: number, slaveDim: number): string {
  const lowerDim = Math.min(masterDim, slaveDim);
  const higherDim = Math.max(masterDim, slaveDim);
  return `${lowerDim}D_${higherDim}D`;
}

/**
 * Filters contact pairs based on the dimensions of master and slave groups
 */
export function filterContactsByDimensions(
  contactPairsData: ContactPairsData,
  masterDim: number,
  slaveDim: number
): ContactPair[] {
  const key = generateContactKey(masterDim, slaveDim);
  const contacts = contactPairsData.contact_pairs[key];
  
  if (!Array.isArray(contacts)) {
    return [];
  }

  return contacts.filter(contact => 
    contact && 
    typeof contact.label === 'string' && 
    typeof contact.description === 'string'
  );
}

/**
 * Infers parameter type from parameter name and value
 */
export function inferParameterType(paramName: string, paramValue: string): "string" | "number" | "boolean" | "select" {
  const lowerName = paramName.toLowerCase();
  const lowerValue = paramValue.toLowerCase();

  // Check for boolean patterns
  for (const pattern of PARAMETER_PATTERNS.boolean) {
    if (pattern.test(lowerName) || pattern.test(lowerValue)) {
      return "boolean";
    }
  }

  // Check for number patterns
  for (const pattern of PARAMETER_PATTERNS.number) {
    if (pattern.test(lowerName)) {
      return "number";
    }
  }

  // Check if value looks like a number
  if (!isNaN(parseFloat(paramValue)) && isFinite(parseFloat(paramValue))) {
    return "number";
  }

  // Check for select options (common in contact definitions)
  if (lowerValue.includes('option') || lowerName.includes('type') || lowerName.includes('algo')) {
    return "select";
  }

  return "string";
}

/**
 * Extracts variable name from template string
 */
export function extractVariableName(template: string): string {
  const match = template.match(/\$\{([^}]+)\}/);
  return match ? match[1] : '';
}

/**
 * Parses parameter templates to generate form field definitions
 */
export function parseParameterTemplates(contact: ContactPair): ParameterField[] {
  const fields: ParameterField[] = [];

  Object.entries(contact.parameters).forEach(([key, value]) => {
    // Extract variable names from template values
    const variableMatches = value.match(/\$\{([^}]+)\}/g);
    
    if (variableMatches) {
      variableMatches.forEach(match => {
        const variableName = extractVariableName(match);
        
        fields.push({
          name: variableName,
          type: inferParameterType(variableName, value),
          required: true,
          placeholder: `Enter ${variableName.replace(/_/g, ' ')}`,
          defaultValue: getDefaultValue(variableName, contact),
          validation: getValidationRules(variableName, contact)
        });
      });
    } else {
      // Static parameter (no template variables)
      fields.push({
        name: key,
        type: inferParameterType(key, value),
        required: false,
        defaultValue: value,
        placeholder: `Enter ${key.replace(/_/g, ' ')}`
      });
    }
  });

  // Remove duplicates and sort by required status
  const uniqueFields = fields.filter((field, index, self) => 
    index === self.findIndex(f => f.name === field.name)
  );

  return uniqueFields.sort((a, b) => {
    if (a.required && !b.required) return -1;
    if (!a.required && b.required) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Gets default value for a parameter based on common patterns
 */
export function getDefaultValue(parameterName: string, _contact: ContactPair): string | number | boolean {
  const lowerName = parameterName.toLowerCase();

  // Friction coefficient defaults
  if (lowerName.includes('friction') || lowerName.includes('coulomb')) {
    return 0.3;
  }

  // Normal stiffness defaults
  if (lowerName === 'e_n') {
    return 1e6;
  }

  // Tangential stiffness defaults
  if (lowerName === 'e_t') {
    return 1e5;
  }

  // Shell thickness defaults
  if (lowerName.includes('thickness') || lowerName.includes('epais')) {
    return 0.01;
  }

  // Boolean defaults
  if (lowerName.includes('lissage') || lowerName.includes('smoothing')) {
    return true;
  }

  return '';
}

/**
 * Gets validation rules for a parameter
 */
export function getValidationRules(parameterName: string, _contact: ContactPair): {
  min?: number;
  max?: number;
  pattern?: string;
} | undefined {
  const lowerName = parameterName.toLowerCase();
  const rules: { min?: number; max?: number; pattern?: string } = {};

  // Friction coefficient validation
  if (lowerName.includes('friction') || lowerName.includes('coulomb')) {
    rules.min = 0;
    rules.max = 1;
  }

  // Stiffness validation
  if (lowerName.includes('stiffness') || lowerName.startsWith('e_')) {
    rules.min = 0;
  }

  // Thickness validation
  if (lowerName.includes('thickness') || lowerName.includes('epais')) {
    rules.min = 0;
    rules.max = 1; // Maximum 1 meter thickness
  }

  return Object.keys(rules).length > 0 ? rules : undefined;
}

/**
 * Validates a complete contact configuration
 */
export function validateContactConfiguration(
  masterGroup: string,
  slaveGroup: string,
  contactMethod: ContactPair | null,
  parameterValues: Record<string, any>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check if groups are selected
  if (!masterGroup) {
    errors.push('Master group is required');
  }

  if (!slaveGroup) {
    errors.push('Slave group is required');
  }

  // Check if groups are different
  if (masterGroup === slaveGroup) {
    errors.push('Master and slave groups must be different');
  }

  // Check if contact method is selected
  if (!contactMethod) {
    errors.push('Contact method is required');
    return { isValid: false, errors };
  }

  // Validate parameters
  const parameterFields = parseParameterTemplates(contactMethod);
  parameterFields.forEach(field => {
    const value = parameterValues[field.name];

    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field.name} is required`);
    }

    if (field.type === 'number' && value !== undefined && value !== '') {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        errors.push(`${field.name} must be a valid number`);
      } else {
        if (field.validation?.min !== undefined && numValue < field.validation.min) {
          errors.push(`${field.name} must be at least ${field.validation.min}`);
        }
        if (field.validation?.max !== undefined && numValue > field.validation.max) {
          errors.push(`${field.name} must be at most ${field.validation.max}`);
        }
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Loads and validates contact pairs data
 */
export async function loadContactPairsData(): Promise<ContactPairsData> {
  try {
    // Import the JSON file directly in Vite
    const { default: data } = await import('../data/contactPairs.json');
    
    if (!isValidContactPairsData(data)) {
      throw new Error('Invalid contact pairs data structure');
    }

    return data;
  } catch (error) {
    console.error('Error loading contact pairs data:', error);
    throw error;
  }
}

/**
 * Processes parameter values by substituting template variables
 */
export function processParameterValues(
  contact: ContactPair,
  parameterValues: Record<string, any>
): Record<string, string> {
  const processed: Record<string, string> = {};

  Object.entries(contact.parameters).forEach(([key, template]) => {
    let processedValue = template;

    // Replace all ${variable} placeholders with actual values
    Object.entries(parameterValues).forEach(([varName, value]) => {
      const placeholder = `\$\{${varName}\}`;
      processedValue = processedValue.replace(
        new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        String(value)
      );
    });

    processed[key] = processedValue;
  });

  return processed;
}
