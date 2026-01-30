import { useState, useEffect, useMemo, useCallback } from 'react'
import type { MeshGroup, MeshGroupInfo, Geometry, Category, ExtendedCategory } from './types'
import { detectCategory, detectDefaultModel, createCompositionString, createGroupId } from './utils'

export const useMeshGroups = (
    meshGroups: Record<string, Record<string, MeshGroupInfo>>,
    onUpdate: (geometries: Geometry[]) => void
) => {
    console.log('📥 useMeshGroups - RECEBENDO do ModelConfig:')
    console.log('   meshGroups:', meshGroups)
    
    const [groups, setGroups] = useState<MeshGroup[]>([])
    const [lastSavedData, setLastSavedData] = useState<string>('')

    // Carregar grupos do estado global
    useEffect(() => {
        if (!meshGroups || Object.keys(meshGroups).length === 0) {
            setGroups([])
            return
        }

        try {
            const loadedGroups: MeshGroup[] = []
            
            Object.entries(meshGroups).forEach(([meshFile, groupsInFile]) => {
                if (!groupsInFile || typeof groupsInFile !== 'object') {
                    console.warn(`Invalid groups data for mesh file: ${meshFile}`, groupsInFile)
                    return
                }
                
                Object.entries(groupsInFile).forEach(([groupName, groupInfo]) => {
                    if (groupName === '_FULL_MESH_') return
                    
                    if (!groupInfo || typeof groupInfo !== 'object') {
                        console.warn(`Invalid group info for: ${groupName}`, groupInfo)
                        return
                    }
                    
                    const basicCategory = detectCategory(groupInfo.types || {}) as ExtendedCategory
                    
                    if (basicCategory === 'Node' || basicCategory === 'Point') return

                    const compStr = createCompositionString(groupInfo.types || {}, basicCategory)

                    loadedGroups.push({
                        id: createGroupId(meshFile, groupName),
                        name: groupName,
                        category: basicCategory as Category,
                        meshFile: meshFile,
                        count: groupInfo.count || 0,
                        composition: compStr,
                        selected: false,
                        physics: 'MECANIQUE',
                        elementType: Object.keys(groupInfo.types || {})[0] || detectDefaultModel(basicCategory as Category),
                        // Adicionar dados originais do meshGroups para referência
                        originalTypes: groupInfo.types || {},
                        originalMedType: groupInfo.med_type
                    })
                })
            })

            setGroups(loadedGroups)
        } catch (error) {
            console.error('Error loading mesh groups:', error)
            setGroups([])
        }
    }, [meshGroups])

    // Sincronizar alterações com o estado global
    useEffect(() => {
        if (!onUpdate || groups.length === 0) return

        try {
            const geometriesData = groups.map(g => ({
                group: g.name,
                meshFile: g.meshFile,
                selected: g.selected,
                physics: g.physics,
                elementType: g.elementType,
                category: g.category,
                count: g.count,
                composition: g.composition,
                _category: g.category
            }))

            const currentData = JSON.stringify(geometriesData)
            if (currentData !== lastSavedData) {
                onUpdate(geometriesData)
                setLastSavedData(currentData)
            }
        } catch (error) {
            console.error('Error saving geometries:', error)
        }
    }, [groups, onUpdate, lastSavedData])

    // Memoizar cálculos pesados
    const groupsByCategory = useMemo(() => ({
        '1D': groups.filter(g => g.category === '1D'),
        '2D': groups.filter(g => g.category === '2D'),
        '3D': groups.filter(g => g.category === '3D')
    }), [groups])

    const selectedCount = useMemo(() => 
        groups.filter(g => g.selected).length, [groups]
    )

    // Handlers otimizados
    const updateGroup = useCallback((id: string, updates: Partial<MeshGroup>) => {
        setGroups(prev => prev.map(group => 
            group.id === id ? { ...group, ...updates } : group
        ))
    }, [])

    const toggleGroup = useCallback((id: string) => {
        setGroups(prev => prev.map(group => 
            group.id === id ? { ...group, selected: !group.selected } : group
        ))
    }, [])

    const updateGroupPhysics = useCallback((id: string, physics: string) => {
        updateGroup(id, { physics: physics as any })
    }, [updateGroup])

    const updateGroupElementType = useCallback((id: string, elementType: string) => {
        updateGroup(id, { elementType })
    }, [updateGroup])

    const selectAll = useCallback(() => {
        setGroups(prev => prev.map(group => ({ ...group, selected: true })))
    }, [])

    const clearAll = useCallback(() => {
        setGroups(prev => prev.map(group => ({ ...group, selected: false })))
    }, [])

    const updateCategoryGroups = useCallback((category: Category, selected: boolean) => {
        setGroups(prev => prev.map(group => 
            group.category === category ? { ...group, selected } : group
        ))
    }, [])

    const selectCategory = useCallback((category: Category) => {
        updateCategoryGroups(category, true)
    }, [updateCategoryGroups])

    const clearCategory = useCallback((category: Category) => {
        updateCategoryGroups(category, false)
    }, [updateCategoryGroups])

    return {
        groups,
        groupsByCategory,
        selectedCount,
        toggleGroup,
        updateGroupPhysics,
        updateGroupElementType,
        selectAll,
        clearAll,
        selectCategory,
        clearCategory
    }
}
