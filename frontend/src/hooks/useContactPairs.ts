/**
 * Custom Hook for Contact Pairs Management
 * 
 * This hook manages the state and logic for the intelligent contact selection system.
 * It handles data loading, group selection, contact filtering, and parameter management.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  ContactPairsData,
  ContactPair,
  GroupDimension,
  UseContactPairsReturn
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

export function useContactPairs(availableGroups: string[] = []): UseContactPairsReturn {
  // Data state
  const [contactPairsData, setContactPairsData] = useState<ContactPairsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Internal state for tracking selections within the hook
  const [internalMasterGroup, setInternalMasterGroup] = useState<string | null>(null);
  const [internalSlaveGroup, setInternalSlaveGroup] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<ContactPair | null>(null);

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

  // Memoize filtered groups for master selection
  const availableMasterGroups = useMemo(() => {
    return availableGroups; // All groups available for master selection
  }, [availableGroups]);

  // Memoize filtered groups for slave selection (based on master selection)
  const availableSlaveGroups = useMemo(() => {
    if (!internalMasterGroup || !contactPairsData || !groupDimensions) {
      return availableGroups; // Show all groups if no master selected
    }

    const masterDimension = groupDimensions.get(internalMasterGroup)?.dimension;
    if (!masterDimension) {
      return availableGroups;
    }

    const filtered = filterGroupsByDimension(
      availableGroups,
      masterDimension,
      groupDimensions,
      contactPairsData
    ).filter(group => group !== internalMasterGroup); // Exclude selected master group
    
    return filtered;
  }, [availableGroups, internalMasterGroup, groupDimensions, contactPairsData]);

  // Memoize available contacts based on selected groups
  const availableContacts = useMemo(() => {
    if (!contactPairsData || !internalMasterGroup || !internalSlaveGroup) {
      return [];
    }

    const masterDim = groupDimensions.get(internalMasterGroup)?.dimension;
    const slaveDim = groupDimensions.get(internalSlaveGroup)?.dimension;

    if (!masterDim || !slaveDim) {
      return [];
    }

    return filterContactsByDimensions(contactPairsData, masterDim, slaveDim);
  }, [contactPairsData, internalMasterGroup, internalSlaveGroup, groupDimensions]);

  // Memoize parameter fields based on selected contact
  const parameterFields = useMemo(() => {
    if (!selectedContact) {
      return [];
    }
    return parseParameterTemplates(selectedContact);
  }, [selectedContact]);

  // Auto-select contact if only one option is available
  useEffect(() => {
    if (availableContacts.length === 1 && !selectedContact) {
      setSelectedContact(availableContacts[0]);
    } else if (availableContacts.length === 0) {
      setSelectedContact(null);
    }
  }, [availableContacts, selectedContact]);

  // Reset parameter values when contact changes
  useEffect(() => {
    if (selectedContact) {
      // Parameter initialization logic would go here if needed
      console.log('Contact selected:', selectedContact.label);
    }
  }, [selectedContact]);

  // Action handlers
  const selectMasterGroup = useCallback((group: string) => {
    console.log('🔍 [HOOK] selectMasterGroup called:', { 
      group, 
      previousMaster: internalMasterGroup,
      timestamp: new Date().toISOString()
    });
    setInternalMasterGroup(group);
    // Reset dependent selections
    setInternalSlaveGroup(null);
    setSelectedContact(null);
  }, [internalMasterGroup]);

  const selectSlaveGroup = useCallback((group: string) => {
    console.log('🔍 [HOOK] selectSlaveGroup called:', { 
      group, 
      internalMasterGroup,
      previousSlave: internalSlaveGroup,
      timestamp: new Date().toISOString()
    });
    if (group === internalMasterGroup) {
      console.log('🔍 [HOOK] selectSlaveGroup - prevented selecting same group as master');
      return; // Prevent selecting same group as master and slave
    }
    setInternalSlaveGroup(group);
    setSelectedContact(null);
  }, [internalMasterGroup, internalSlaveGroup]);

  const selectContactMethod = useCallback((contact: ContactPair) => {
    setSelectedContact(contact);
  }, []);

  const updateParameter = useCallback((name: string, value: any) => {
    // Parameter update logic would go here if needed
    console.log('Parameter updated:', name, value);
  }, []);

  const resetSelection = useCallback(() => {
    setInternalMasterGroup(null);
    setInternalSlaveGroup(null);
    setSelectedContact(null);
  }, []);

  // Utility functions
  const detectGroupDimensionUtil = useCallback((groupName: string): GroupDimension => {
    return detectGroupDimension(groupName);
  }, []);

  const filterContactsByDimensionsUtil = useCallback((masterDim: number, slaveDim: number): ContactPair[] => {
    if (!contactPairsData) return [];
    return filterContactsByDimensions(contactPairsData, masterDim, slaveDim);
  }, [contactPairsData]);


  // Validation (unused for now but available for future use)
  // const validationState = useMemo(() => {
  //   if (!selectedMasterGroup || !selectedSlaveGroup || !selectedContact) {

  // Process parameters for output (unused for now but available for future use)
  // const processedParameters = useMemo(() => {
  //   if (!selectedContact) return {};
  //   return processParameterValues(selectedContact, parameterValues);
  // }, [selectedContact, parameterValues]);

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
    
    // Actions
    selectMasterGroup,
    selectSlaveGroup,
    selectContactMethod,
    updateParameter,
    resetSelection,
    
    // Utilities
    detectGroupDimension: detectGroupDimensionUtil,
    filterContactsByDimensions: filterContactsByDimensionsUtil,
    areDimensionsCompatible: (dim1: number, dim2: number) => 
      contactPairsData ? areDimensionsCompatible(dim1, dim2, contactPairsData) : false
  };
}
