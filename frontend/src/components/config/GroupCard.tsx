import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { MeshGroup } from './types'
import { CATEGORY_CONFIG, PHYSICS_OPTIONS } from './constants'

interface GroupCardProps {
    group: MeshGroup
    onToggle: (id: string) => void
    onUpdatePhysics: (id: string, physics: string) => void
    onUpdateElementType: (id: string, elementType: string) => void
}

export default function GroupCard({ group, onToggle, onUpdatePhysics, onUpdateElementType }: GroupCardProps) {
    const categoryConfig = CATEGORY_CONFIG[group.category]
    const color = categoryConfig.color

    // Usar dados originais do meshGroups quando disponíveis
    const availableElementTypes = Object.keys(group.originalTypes || {})
    const primaryElementType = group.originalMedType || availableElementTypes[0] || group.elementType

    console.log(`🎯 [GroupCard] ${group.name}:`)
    console.log('   originalTypes:', group.originalTypes)
    console.log('   originalMedType:', group.originalMedType)
    console.log('   availableElementTypes:', availableElementTypes)
    console.log('   primaryElementType:', primaryElementType)

    return (
        <Card 
            className={`transition-all duration-300 border ${
                group.selected 
                    ? `bg-gradient-to-r from-${color}-500/10 to-${color}-600/10 border-${color}-500/30 shadow-lg shadow-${color}-500/10` 
                    : 'bg-slate-900/30 border-slate-700/50 opacity-60'
            }`}
        >
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    <Checkbox
                        checked={group.selected}
                        onCheckedChange={() => onToggle(group.id)}
                        className={`w-4 h-4 mt-1 ${
                            group.selected 
                                ? `border-${color}-500 bg-${color}-500` 
                                : 'border-slate-600 bg-slate-800'
                        }`}
                    />
                    <div className="flex-1 space-y-3">
                        <div>
                            <h4 className="font-medium text-white mb-1">{group.name}</h4>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span>{group.composition}</span>
                                <span>•</span>
                                <span>{group.count} elements</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Select 
                                value={group.physics}
                                onValueChange={(value) => onUpdatePhysics(group.id, value)}
                                disabled={!group.selected}
                            >
                                <SelectTrigger className={`border-slate-700 bg-slate-800/50 text-xs ${
                                    !group.selected ? 'opacity-50 cursor-not-allowed' : `hover:border-${color}-500/50`
                                }`}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="border-slate-700 bg-slate-800">
                                    {PHYSICS_OPTIONS.map(physics => (
                                        <SelectItem key={physics} value={physics}>{physics}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select 
                                value={group.elementType}
                                onValueChange={(value) => onUpdateElementType(group.id, value)}
                                disabled={!group.selected}
                            >
                                <SelectTrigger className={`border-slate-700 bg-slate-800/50 text-xs ${
                                    !group.selected ? 'opacity-50 cursor-not-allowed' : `hover:border-${color}-500/50`
                                }`}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="border-slate-700 bg-slate-800">
                                    {/* Usar tipos reais do meshGroups primeiro, depois fallback para config */}
                                    {availableElementTypes.length > 0 ? (
                                        availableElementTypes.map(elementType => (
                                            <SelectItem key={elementType} value={elementType}>
                                                {elementType} {group.originalTypes[elementType] > 1 ? `(${group.originalTypes[elementType]})` : ''}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        categoryConfig.elementTypes.map(elementType => (
                                            <SelectItem key={elementType} value={elementType}>{elementType}</SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
