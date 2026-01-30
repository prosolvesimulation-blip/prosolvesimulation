import { useState, useMemo } from 'react'
import { memo } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { getFormulationType, getFormulationLabel } from '@/lib/modelIntelligence'
import { CATEGORY_CONFIG, BADGE_VARIANTS } from '@/constants/modelConfig'

export interface MeshGroupData {
    med_type: string
    category: string
    count: number
}

interface MeshGroupCardProps {
    groupName: string
    groupData: MeshGroupData
    fileName: string
    selected?: boolean
    onToggle?: () => void
    phenomenene?: string
    modelisation?: string
    formulation?: string
    onPhenomeneChange?: (value: string) => void
    onModelisationChange?: (value: string) => void
    loading: boolean
    getAvailablePhenomenes: (category: string) => any[]
    getAvailableModelisations: (category: string, phenomenene: string) => any[]
    getFilteredModelisations: (category: string, phenomenene: string, formulation: string) => any[]
}

// Custom comparison function for React.memo
function arePropsEqual(prevProps: MeshGroupCardProps, nextProps: MeshGroupCardProps) {
    return (
        prevProps.groupName === nextProps.groupName &&
        prevProps.fileName === nextProps.fileName &&
        prevProps.selected === nextProps.selected &&
        prevProps.loading === nextProps.loading &&
        prevProps.phenomenene === nextProps.phenomenene &&
        prevProps.modelisation === nextProps.modelisation &&
        prevProps.formulation === nextProps.formulation &&
        JSON.stringify(prevProps.groupData) === JSON.stringify(nextProps.groupData)
    )
}

export default memo(function MeshGroupCard({ 
    groupName, 
    groupData, 
    fileName, 
    selected = false, 
    onToggle,
    phenomenene,
    modelisation,
    formulation,
    onPhenomeneChange,
    onModelisationChange,
    loading,
    getAvailablePhenomenes,
    getAvailableModelisations,
    getFilteredModelisations
}: MeshGroupCardProps) {
    const categoryConfig = CATEGORY_CONFIG[groupData.category as keyof typeof CATEGORY_CONFIG]
    const badgeVariant = BADGE_VARIANTS[groupData.category as keyof typeof BADGE_VARIANTS]
    const color = categoryConfig?.color || 'slate'
    
    const [isExpanded, setIsExpanded] = useState(false)
    
    // Get available phenomenes for this group's dimension
    const availablePhenomenes = useMemo(() => {
        return getAvailablePhenomenes(groupData.category)
    }, [getAvailablePhenomenes, groupData.category])
    
    // Get available modelisations for selected phenomene
    const availableModelisations = useMemo(() => {
        return getAvailableModelisations(groupData.category, phenomenene || '')
    }, [getAvailableModelisations, groupData.category, phenomenene])
    
    // Auto-detect formulation based on group name
    const autoFormulation = useMemo(() => {
        return getFormulationType(groupName)
    }, [groupName])
    
    // Filter modelisations by formulation
    const filteredModelisations = useMemo(() => {
        if (!formulation) return availableModelisations
        return getFilteredModelisations(groupData.category, phenomenene || '', formulation)
    }, [getFilteredModelisations, groupData.category, phenomenene, formulation, availableModelisations])
    
    const currentPhenomene = phenomenene || availablePhenomenes[0]?.phenomene || 'MECANIQUE'
    const currentModelisation = modelisation || filteredModelisations[0]?.name || ''
    const currentFormulation = formulation || autoFormulation

    return (
        <Card className={`relative overflow-hidden transition-all duration-300 ${
            selected 
                ? `border-${color}-500/60 bg-gradient-to-br from-${color}-500/10 via-${color}-600/5 to-slate-900/50 shadow-xl shadow-${color}-500/20 ring-2 ring-${color}-500/30` 
                : 'border-slate-700/40 bg-slate-900/30 hover:border-slate-600/50 hover:bg-slate-900/40 hover:shadow-lg'
        }`}>
            {selected && (
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-${color}-500 to-${color}-600`}></div>
            )}
            <CardContent className="p-5">
                <div className="flex items-start gap-4">
                    <div className="relative">
                        <Checkbox
                            checked={selected}
                            onCheckedChange={onToggle}
                            className={`w-5 h-5 mt-1 transition-all duration-200 ${
                                selected 
                                    ? `border-${color}-500 bg-${color}-500 ring-2 ring-${color}-500/50` 
                                    : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                            }`}
                        />
                        {selected && (
                            <div className={`absolute -inset-1 bg-${color}-500/20 rounded-full animate-ping`}></div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-4">
                            <div className="min-w-0 flex-1">
                                <h4 className="font-semibold text-white text-base mb-1 truncate">{groupName}</h4>
                                <p className="text-sm text-slate-400 truncate">{fileName}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant={badgeVariant} className="text-xs font-medium px-2.5 py-1">
                                    {categoryConfig?.label || groupData.category}
                                </Badge>
                                {selected && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsExpanded(!isExpanded)}
                                        className="h-6 w-6 p-0 hover:bg-slate-700/50"
                                    >
                                        <svg
                                            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </Button>
                                )}
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-2">
                            <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                                <div className="text-xs text-slate-500 mb-1">Element Type</div>
                                <div className="text-sm font-mono text-slate-300">{groupData.med_type}</div>
                            </div>
                            <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                                <div className="text-xs text-slate-500 mb-1">Elements</div>
                                <div className="text-sm font-mono text-slate-300">{groupData.count.toLocaleString()}</div>
                            </div>
                        </div>
                        
                        {/* Selection Summary - Visible when card is collapsed */}
                        {selected && !isExpanded && (currentPhenomene || currentModelisation) && (
                            <div className="mt-3 pt-3 border-t border-slate-700/30">
                                <div className="space-y-2">
                                    {currentPhenomene && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-500">Phenomenon:</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-blue-400 font-medium">
                                                    {availablePhenomenes.find(p => p.phenomene === currentPhenomene)?.label_en || currentPhenomene}
                                                </span>
                                                <span className="text-slate-600 font-mono text-xs">
                                                    ({currentPhenomene})
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    {currentModelisation && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-500">Modelisation:</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-green-400 font-medium">
                                                    {filteredModelisations.find(m => m.name === currentModelisation)?.label_en || currentModelisation}
                                                </span>
                                                <span className="text-slate-600 font-mono text-xs">
                                                    ({currentModelisation})
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    {currentFormulation && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-500">Formulation:</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-purple-400 font-medium">
                                                    {getFormulationLabel(currentFormulation)}
                                                </span>
                                                <span className="text-slate-600 font-mono text-xs">
                                                    ({currentFormulation})
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {selected && isExpanded && (
                            <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-3 animate-in slide-in-from-top-2 duration-300">
                                {/* Phenomene Selection */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Phenomenon Type</label>
                                    <div className="flex flex-wrap gap-2">
                                        {availablePhenomenes.map(phenomene => (
                                            <Button
                                                key={phenomene.phenomene}
                                                variant={currentPhenomene === phenomene.phenomene ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => onPhenomeneChange?.(phenomene.phenomene)}
                                                disabled={!selected || loading}
                                                className={`text-xs px-3 py-1.5 h-auto transition-all duration-200 ${
                                                    currentPhenomene === phenomene.phenomene
                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30'
                                                        : 'border-slate-600/50 text-slate-300 hover:border-slate-500 hover:bg-slate-700/50'
                                                }`}
                                            >
                                                <div className="flex flex-col items-center">
                                                    <span className="font-medium">{phenomene.label_en}</span>
                                                    <span className="text-xs opacity-70">{phenomene.phenomene}</span>
                                                </div>
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                {/* Modelisation Selection */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Element Modelisation</label>
                                    <div className="space-y-2">
                                        {filteredModelisations.map(modelisation => (
                                            <Button
                                                key={modelisation.name}
                                                variant={currentModelisation === modelisation.name ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => onModelisationChange?.(modelisation.name)}
                                                disabled={!selected || loading}
                                                className={`w-full text-xs px-3 py-2 h-auto transition-all duration-200 text-left justify-start ${
                                                    currentModelisation === modelisation.name
                                                        ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-600/30'
                                                        : 'border-slate-600/50 text-slate-300 hover:border-slate-500 hover:bg-slate-700/50'
                                                }`}
                                            >
                                                <div className="flex flex-col items-start w-full">
                                                    <div className="flex items-center justify-between w-full">
                                                        <span className="font-medium">{modelisation.label_en}</span>
                                                        <span className="text-xs opacity-70 font-mono">{modelisation.name}</span>
                                                    </div>
                                                    {modelisation.description && (
                                                        <span className="text-xs opacity-60 mt-1">{modelisation.description}</span>
                                                    )}
                                                </div>
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                {/* Formulation Display */}
                                {currentModelisation && (
                                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Formulation</label>
                                                <div className="mt-1 flex items-center gap-2">
                                                    <span className="text-sm font-medium text-blue-400">
                                                        {getFormulationLabel(currentFormulation)}
                                                    </span>
                                                    <span className="text-xs text-slate-500 font-mono bg-slate-900/50 px-2 py-1 rounded">
                                                        {currentFormulation}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}, arePropsEqual)
