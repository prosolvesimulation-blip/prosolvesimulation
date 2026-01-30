import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Layers } from "lucide-react"
import MeshGroupCard from './MeshGroupCard'

interface MeshGroupData {
    med_type: string
    category: string
    count: number
}

interface MeshFileCardProps {
    fileName: string
    groups: Record<string, MeshGroupData>
}

export default function MeshFileCard({ fileName, groups }: MeshFileCardProps) {
    const groupEntries = Object.entries(groups)
    const totalElements = Object.values(groups).reduce((sum, group) => sum + group.count, 0)
    const categoryCounts = Object.values(groups).reduce((acc, group) => {
        acc[group.category] = (acc[group.category] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    return (
        <Card className="bg-slate-800/30 border-slate-700/30 overflow-hidden">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-700/50 rounded-lg">
                        <FileText size={16} className="text-slate-400" />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-lg text-white font-medium">{fileName}</CardTitle>
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                                <Layers size={12} />
                                {groupEntries.length} groups
                            </span>
                            <span>{totalElements.toLocaleString()} total elements</span>
                        </div>
                    </div>
                </div>
                
                {/* Category Summary */}
                <div className="flex flex-wrap gap-2 mt-3">
                    {Object.entries(categoryCounts).map(([category, count]) => (
                        <div 
                            key={category}
                            className={`px-2 py-1 rounded text-xs font-medium ${
                                category === '1D' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                category === '2D' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                category === '3D' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                category === 'Node' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                            }`}
                        >
                            {category}: {count}
                        </div>
                    ))}
                </div>
            </CardHeader>
            
            <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {groupEntries.map(([groupName, groupData]) => (
                        <MeshGroupCard
                            key={groupName}
                            groupName={groupName}
                            groupData={groupData}
                            fileName={fileName}
                            loading={false}
                            getAvailablePhenomenes={() => []}
                            getAvailableModelisations={() => []}
                            getFilteredModelisations={() => []}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
