/**
 * Model Options Intelligence Module
 * Handles dynamic loading and filtering of Code_Aster model options
 */

// Types for the model options structure
export interface Modelisation {
  name: string
  label_en: string
  description?: string
  formulations: string[]
}

export interface Phenomene {
  phenomene: string
  label_en: string
  modelisations: Modelisation[]
}

export interface DimensionOption {
  dimension: string
  phenomenes: Phenomene[]
}

export interface ModelOptionsData {
  dimensions: DimensionOption[]
}

// Cache for loaded data
let cachedModelOptions: ModelOptionsData | null = null

/**
 * Loads and validates model options data from JSON
 */
export async function loadModelOptionsData(): Promise<ModelOptionsData> {
  try {
    // Import the JSON file directly in Vite
    const { default: rawData } = await import('../data/modelOptions.json');
    
    if (!Array.isArray(rawData)) {
      throw new Error('Invalid model options data: expected array');
    }

    // The data is already in the correct format: array of dimensions
    const data: ModelOptionsData = { dimensions: rawData };

    // Validate the structure
    if (!isValidModelOptionsData(data)) {
      throw new Error('Invalid model options data structure');
    }

    cachedModelOptions = data;
    return data;
  } catch (error) {
    console.error('Error loading model options data:', error);
    throw error;
  }
}

/**
 * Validates the model options data structure
 */
function isValidModelOptionsData(data: ModelOptionsData): boolean {
  if (!data || !Array.isArray(data.dimensions)) {
    return false;
  }

  return data.dimensions.every(dimension => 
    dimension.dimension && 
    Array.isArray(dimension.phenomenes) &&
    dimension.phenomenes.every(phenomene => 
      phenomene.phenomene && 
      phenomene.label_en && 
      Array.isArray(phenomene.modelisations) &&
      phenomene.modelisations.every(modelisation => 
        modelisation.name && 
        modelisation.label_en && 
        Array.isArray(modelisation.formulations)
      )
    )
  );
}

/**
 * Gets available phenomenes for a specific dimension
 */
export function getPhenomenesForDimension(
  modelOptions: ModelOptionsData, 
  dimension: string
): Phenomene[] {
  const dimensionData = modelOptions.dimensions.find(d => d.dimension === dimension);
  return dimensionData?.phenomenes || [];
}

/**
 * Gets available modelisations for dimension and phenomene
 */
export function getModelisationsForPhenomene(
  modelOptions: ModelOptionsData, 
  dimension: string, 
  phenomene: string
): Modelisation[] {
  const phenomenes = getPhenomenesForDimension(modelOptions, dimension);
  const phenomeneData = phenomenes.find(p => p.phenomene === phenomene);
  return phenomeneData?.modelisations || [];
}

/**
 * Determines formulation type based on element name
 */
export function getFormulationType(elementName: string): string {
  // Linear elements (typically 4-6 nodes)
  const linearPatterns = [
    /^TRI[3-6]/,     // TRI3, TRIA6, etc.
    /^QUAD[4-6]/,    // QUAD4, QUAD6, etc.
    /^HEX[8]/,       // HEX8
    /^TET[4]/,       // TET4
    /^PYR[5]/,       // PYR5
    /^WED[6]/,       // WED6
    /.*[3-6]$/,      // Anything ending with 3-6
  ];

  // Quadratic elements (typically 8-20 nodes)
  const quadraticPatterns = [
    /^TRI[7-9]/,     // TRI7, TRIA9, etc.
    /^TRI1[0-9]/,    // TRI10-19
    /^QUAD[8-9]/,    // QUAD8, QUAD9
    /^QUAD1[0-9]/,   // QUAD10-19
    /^HEX[2-9][0-9]/,// HEX20, HEX27, etc.
    /^TET[1-9][0-9]/,// TET10, TET15, etc.
    /^PYR[1-9][0-9]/,// PYR13, PYR14, etc.
    /^WED[1-9][0-9]/,// WED15, WED20, etc.
    /.*[8-9]$/,      // Anything ending with 8-9
    /.*1[0-9]$/,     // Anything ending with 10-19
    /.*2[0-9]$/,     // Anything ending with 20-29
  ];

  const upperName = elementName.toUpperCase();

  for (const pattern of quadraticPatterns) {
    if (pattern.test(upperName)) {
      return 'QUADRATIQUE';
    }
  }

  for (const pattern of linearPatterns) {
    if (pattern.test(upperName)) {
      return 'LINEAIRE';
    }
  }

  // Default to linear if no pattern matches
  return 'LINEAIRE';
}

/**
 * Gets formulation label for display
 */
export function getFormulationLabel(formulation: string): string {
  const labels: Record<string, string> = {
    'LINEAIRE': 'Linear',
    'QUADRATIQUE': 'Quadratic',
    'U_P_PHI': 'U-P-φ',
    'U_P': 'U-P',
    'U_PSI': 'U-ψ',
    'DIL': 'Dilatational',
    'DIL_INCO': 'Dilatational Incompressible'
  };
  
  return labels[formulation] || formulation;
}

/**
 * Gets cached model options or loads them if not cached
 */
export async function getModelOptions(): Promise<ModelOptionsData> {
  if (cachedModelOptions) {
    return cachedModelOptions;
  }
  
  return await loadModelOptionsData();
}

/**
 * Filters modelisations based on available formulations
 */
export function filterModelisationsByFormulation(
  modelisations: Modelisation[], 
  formulation: string
): Modelisation[] {
  return modelisations.filter(modelisation => 
    modelisation.formulations.length === 0 || 
    modelisation.formulations.includes(formulation)
  );
}
