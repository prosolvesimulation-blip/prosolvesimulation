/**
 * Contact Pairs Type Definitions
 * 
 * This file contains TypeScript interfaces for the contact pairs data structure
 * used in ProSolve simulation for finite element contact interactions.
 */

export interface ContactParameter {
  [key: string]: string;
}

export interface ContactPair {
  label: string;
  behavior: "Linear" | "Non-Linear";
  command: string;
  sub_command?: string;
  description: string;
  parameters: ContactParameter;
}

export interface ContactPairsData {
  contact_pairs: {
    description: string;
    "1D_2D": ContactPair[];
    "1D_3D": ContactPair[];
    "2D_2D": ContactPair[];
    "2D_3D": ContactPair[];
    "3D_3D": ContactPair[];
    [key: string]: ContactPair[] | string;
  };
}

export interface ParameterField {
  name: string;
  type: "string" | "number" | "boolean" | "select";
  required: boolean;
  defaultValue?: string | number | boolean;
  options?: string[]; // For select type
  placeholder?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface GroupDimension {
  groupName: string;
  dimension: 1 | 2 | 3;
  confidence: number; // 0-1, how confident we are about the dimension detection
}

export interface ContactSelection {
  id: string;
  name: string;
  masterGroup: string;
  slaveGroup: string;
  masterDimension: 1 | 2 | 3;
  slaveDimension: 1 | 2 | 3;
  contactMethod: ContactPair | null;
  parameters: Record<string, any>;
  isValid: boolean;
}

export interface ContactIntelligenceState {
  availableGroups: string[];
  groupDimensions: Map<string, GroupDimension>;
  selectedGroups: {
    master: string | null;
    slave: string | null;
  };
  availableContacts: ContactPair[];
  selectedContact: ContactPair | null;
  parameterFields: ParameterField[];
  parameterValues: Record<string, any>;
  isLoading: boolean;
  error: string | null;
}

export interface UseContactPairsReturn {
  // Data
  contactPairsData: ContactPairsData | null;
  isLoading: boolean;
  error: string | null;
  
  // Computed values
  availableContacts: ContactPair[];
  parameterFields: ParameterField[];
  groupDimensions: Map<string, GroupDimension>;
  availableMasterGroups: string[];
  availableSlaveGroups: string[];
  compatibilityMatrix: { [key: string]: number[] } | null;
  
  // Actions
  selectMasterGroup: (group: string) => void;
  selectSlaveGroup: (group: string) => void;
  selectContactMethod: (contact: ContactPair) => void;
  updateParameter: (name: string, value: any) => void;
  resetSelection: () => void;
  
  // Utilities
  detectGroupDimension: (groupName: string) => GroupDimension;
  filterContactsByDimensions: (masterDim: number, slaveDim: number) => ContactPair[];
  areDimensionsCompatible: (dim1: number, dim2: number) => boolean;
}

// Type guards
export function isValidContactPair(obj: any): obj is ContactPair {
  return (
    obj &&
    typeof obj.label === 'string' &&
    (obj.behavior === 'Linear' || obj.behavior === 'Non-Linear') &&
    typeof obj.command === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.parameters === 'object' &&
    obj.parameters !== null
  );
}

export function isValidContactPairsData(obj: any): obj is ContactPairsData {
  return (
    obj &&
    obj.contact_pairs &&
    typeof obj.contact_pairs.description === 'string' &&
    Array.isArray(obj.contact_pairs["1D_2D"]) &&
    Array.isArray(obj.contact_pairs["1D_3D"]) &&
    Array.isArray(obj.contact_pairs["2D_2D"]) &&
    Array.isArray(obj.contact_pairs["2D_3D"]) &&
    Array.isArray(obj.contact_pairs["3D_3D"])
  );
}
