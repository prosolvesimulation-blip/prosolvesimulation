import { Button } from "@/components/ui/button"
import { Box } from "lucide-react"
import type { MeshGroup, Category } from './types'
import { CATEGORY_CONFIG } from './constants'
import GroupCard from './GroupCard'

interface CategoryColumnProps {
    category: Category
    groups: MeshGroup[]
    onToggle: (id: string) => void
    onUpdatePhysics: (id: string, physics: string) => void
    onUpdateElementType: (id: string, elementType: string) => void
    onSelectCategory: (category: Category) => void
    onClearCategory: (category: Category) => void
}

export default function CategoryColumn({ 
    category, 
    groups, 
    onToggle, 
    onUpdatePhysics, 
    onUpdateElementType,
    onSelectCategory,
    onClearCategory 
}: CategoryColumnProps) {
    const categoryConfig = CATEGORY_CONFIG[category]
    const color = categoryConfig.color

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-${color}-500/10 to-${color}-600/10 border-${color}-500/30">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-${color}-500/20 border-${color}-500/40 flex items-center justify-center">
                        <Box className={`w-4 h-4 text-${color}-400`} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">{categoryConfig.label}</h3>
                        <p className="text-xs text-${color}-300">{categoryConfig.description}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button 
                        size="sm"
                        onClick={() => onSelectCategory(category)}
                        className={`bg-${color}-500 hover:bg-${color}-600 border-0 text-xs px-2 py-1`}
                    >
                        All
                    </Button>
                    <Button 
                        size="sm"
                        variant="outline"
                        onClick={() => onClearCategory(category)}
                        className={`border-${color}-500/50 text-${color}-300 hover:bg-${color}-500/10 text-xs px-2 py-1`}
                    >
                        Clear
                    </Button>
                </div>
            </div>

            {/* Groups List */}
            <div className="space-y-3">
                {groups.map((group) => (
                    <GroupCard
                        key={group.id}
                        group={group}
                        onToggle={onToggle}
                        onUpdatePhysics={onUpdatePhysics}
                        onUpdateElementType={onUpdateElementType}
                    />
                ))}
            </div>
        </div>
    )
}
