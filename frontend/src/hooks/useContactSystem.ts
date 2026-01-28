/**
 * Individual Contact System Hook
 * 
 * This hook manages the state for a single intelligent contact card.
 * It handles group selection, contact filtering, and parameter management.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  ContactPairsData,
  ContactPair,
  GroupDimension,
} from '../types/contact';
import {
  loadContactPairsData,
  detectGroupDimension,
  filterContactsByDimensions,
  parseParameterTemplates
} from '../lib/contactIntelligence';
import {
  buildCompatibilityMatrix,
  areDimensionsCompatible,
  filterGroupsByDimension
} from '../lib/dimensionalCompatibility';

export function useContactSystem(availableGroups: string[] = [], masterGroup: string | null = null, slaveGroup: string | null = null) {
  // Data state
  const [contactPairsData, setContactPairsData] = useState<ContactPairsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load contact pairs data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await loadContactPairsData();
        setContactPairsData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load contact pairs data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Memoize group dimensions for performance
  const groupDimensions = useMemo(() => {
    const dimensions = new Map<string, GroupDimension>();
    availableGroups.forEach(group => {
      const dimension = detectGroupDimension(group);
      dimensions.set(group, dimension);
    });
    return dimensions;
  }, [availableGroups]);

  // Memoize compatibility matrix
  const compatibilityMatrix = useMemo(() => {
    if (!contactPairsData) return null;
    const matrix = buildCompatibilityMatrix(contactPairsData);
    return matrix;
  }, [contactPairsData]);

  // Memoize filtered groups for master selection (all groups)
  const availableMasterGroups = useMemo(() => {
    return availableGroups;
  }, [availableGroups]);

  // Memoize filtered groups for slave selection (based on master selection)
  const availableSlaveGroups = useMemo(() => {
    if (!masterGroup || !contactPairsData || !groupDimensions) {
      return availableGroups; // Show all groups if no master selected
    }

    const masterDimension = groupDimensions.get(masterGroup)?.dimension;
    if (!masterDimension) {
      return availableGroups;
    }

    const filtered = filterGroupsByDimension(
      availableGroups,
      masterDimension,
      groupDimensions,
      contactPairsData
    ).filter(group => group !== masterGroup); // Exclude selected master group
    
    return filtered;
  }, [availableGroups, masterGroup, groupDimensions, contactPairsData]);

  // Memoize available contacts based on selected groups
  const availableContacts = useMemo(() => {
    if (!contactPairsData || !masterGroup || !slaveGroup) {
      return [];
    }

    const masterDim = groupDimensions.get(masterGroup)?.dimension;
    const slaveDim = groupDimensions.get(slaveGroup)?.dimension;

    if (!masterDim || !slaveDim) {
      return [];
    }

    return filterContactsByDimensions(contactPairsData, masterDim, slaveDim);
  }, [contactPairsData, masterGroup, slaveGroup, groupDimensions]);

  // Memoize parameter fields based on selected contact
  const parameterFields = useMemo(() => {
    if (!availableContacts || availableContacts.length === 0) {
      return [];
    }
    // Use the first available contact for parameter fields
    return parseParameterTemplates(availableContacts[0]);
  }, [availableContacts]);

  // Utility functions
  const detectGroupDimensionUtil = useCallback((groupName: string): GroupDimension => {
    return detectGroupDimension(groupName);
  }, []);

  const filterContactsByDimensionsUtil = useCallback((masterDim: number, slaveDim: number): ContactPair[] => {
    if (!contactPairsData) return [];
    return filterContactsByDimensions(contactPairsData, masterDim, slaveDim);
  }, [contactPairsData]);

  return {
    // Data
    contactPairsData,
    isLoading,
    error,
    
    // Computed values
    availableContacts,
    parameterFields,
    groupDimensions,
    availableMasterGroups,
    availableSlaveGroups,
    compatibilityMatrix,
    
    // Utilities
    detectGroupDimension: detectGroupDimensionUtil,
    filterContactsByDimensions: filterContactsByDimensionsUtil,
    areDimensionsCompatible: (dim1: number, dim2: number) => 
      contactPairsData ? areDimensionsCompatible(dim1, dim2, contactPairsData) : false
  };
}
