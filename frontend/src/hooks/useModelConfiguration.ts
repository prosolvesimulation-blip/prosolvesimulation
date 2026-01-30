/**
 * Model Configuration Hook
 * Manages state and logic for mesh group configuration
 */

import { useState, useEffect, useCallback } from 'react';
import { getModelOptions, getPhenomenesForDimension, getModelisationsForPhenomene, filterModelisationsByFormulation, getFormulationType, type ModelOptionsData } from '@/lib/modelIntelligence';

export interface MeshGroupData {
    med_type: string;
    category: string;
    count: number;
}

export interface GroupConfiguration {
    phenomenene: string;
    modelisation: string;
    formulation: string;
}

export interface UseModelConfigurationResult {
    modelOptions: ModelOptionsData | null;
    loading: boolean;
    selectedGroups: Set<string>;
    groupConfigurations: Record<string, GroupConfiguration>;
    toggleGroup: (groupKey: string) => void;
    updatePhenomene: (groupKey: string, phenomenene: string) => void;
    updateModelisation: (groupKey: string, modelisation: string) => void;
    isGroupSelected: (fileName: string, groupName: string) => boolean;
    getGroupConfiguration: (fileName: string, groupName: string) => GroupConfiguration;
    getAvailablePhenomenes: (category: string) => any[];
    getAvailableModelisations: (category: string, phenomenene: string) => any[];
    getFilteredModelisations: (category: string, phenomenene: string, formulation: string) => any[];
    filterGroups: (groups: Record<string, any>) => Record<string, any>;
}

export function useModelConfiguration(): UseModelConfigurationResult {
    const [modelOptions, setModelOptions] = useState<ModelOptionsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
    const [groupConfigurations, setGroupConfigurations] = useState<Record<string, GroupConfiguration>>({});

    // Load model options once
    useEffect(() => {
        getModelOptions().then(data => {
            setModelOptions(data);
            setLoading(false);
        }).catch(error => {
            console.error('Error loading model options:', error);
            setLoading(false);
        });
    }, []);

    const toggleGroup = useCallback((groupKey: string) => {
        setSelectedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupKey)) {
                newSet.delete(groupKey);
            } else {
                newSet.add(groupKey);
            }
            return newSet;
        });
    }, []);

    const updatePhenomene = useCallback((groupKey: string, phenomenene: string) => {
        setGroupConfigurations(prev => {
            const updated = {
                ...prev,
                [groupKey]: {
                    ...prev[groupKey],
                    phenomenene
                }
            };
            // Auto-update formulation when phenomene changes
            const [, groupName] = groupKey.split(':');
            const autoFormulation = getFormulationType(groupName);
            updated[groupKey].formulation = autoFormulation;
            return updated;
        });
    }, []);

    const updateModelisation = useCallback((groupKey: string, modelisation: string) => {
        setGroupConfigurations(prev => ({
            ...prev,
            [groupKey]: {
                ...prev[groupKey],
                modelisation
            }
        }));
    }, []);

    const isGroupSelected = useCallback((fileName: string, groupName: string) => {
        return selectedGroups.has(`${fileName}:${groupName}`);
    }, [selectedGroups]);

    const getGroupConfiguration = useCallback((fileName: string, groupName: string): GroupConfiguration => {
        const key = `${fileName}:${groupName}`;
        const existing = groupConfigurations[key];
        
        if (existing) {
            return existing;
        }
        
        // Auto-detect formulation based on group name
        const autoFormulation = getFormulationType(groupName);
        
        // Dynamic defaults based on available options
        return { phenomenene: '', modelisation: '', formulation: autoFormulation };
    }, [groupConfigurations]);

    const getAvailablePhenomenes = useCallback((category: string) => {
        if (!modelOptions || !category) return [];
        return getPhenomenesForDimension(modelOptions, category);
    }, [modelOptions]);

    const getAvailableModelisations = useCallback((category: string, phenomenene: string) => {
        if (!modelOptions || !category || !phenomenene) return [];
        return getModelisationsForPhenomene(modelOptions, category, phenomenene);
    }, [modelOptions]);

    const getFilteredModelisations = useCallback((category: string, phenomenene: string, formulation: string) => {
        const availableModelisations = getAvailableModelisations(category, phenomenene);
        if (!formulation) return availableModelisations;
        return filterModelisationsByFormulation(availableModelisations, formulation);
    }, [getAvailableModelisations]);

    const filterGroups = useCallback((groups: Record<string, any>) => {
        const filtered: Record<string, any> = {};
        Object.entries(groups).forEach(([groupName, groupInfo]) => {
            // Exclude _FULL_MESH_ groups (hardcoded as requested)
            if (groupName === '_FULL_MESH_' || groupName === '_FULL_MESH' || groupName.includes('FULL_MESH')) {
                return;
            }
            // Exclude Node groups
            if (groupInfo?.category === 'Node') {
                return;
            }
            filtered[groupName] = groupInfo;
        });
        return filtered;
    }, []);

    return {
        modelOptions,
        loading,
        selectedGroups,
        groupConfigurations,
        toggleGroup,
        updatePhenomene,
        updateModelisation,
        isGroupSelected,
        getGroupConfiguration,
        getAvailablePhenomenes,
        getAvailableModelisations,
        getFilteredModelisations,
        filterGroups
    };
}
