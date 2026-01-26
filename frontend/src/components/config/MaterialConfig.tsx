import { useState, useEffect, useRef, useMemo } from 'react'
import { Plus, Trash2, Layers } from 'lucide-react'

interface Material {
    id: string
    name: string
    E: string // Young's Modulus
    nu: string // Poisson's Ratio
    rho: string // Density
    assignedGroups: string[]
}

interface MaterialConfigProps {
    projectPath: string | null
    availableGroups?: string[]
    nodeGroups?: string[]
    initialMaterials?: any[]
    onUpdate?: (materials: any[]) => void
}

export default function MaterialConfig({
    projectPath,
    availableGroups = [],
    nodeGroups = [],
    initialMaterials = [],
    onUpdate
}: MaterialConfigProps) {
    const isFirstRender = useRef(true)

    // Filtrar grupos que podem receber material (Remover Nodes)
    const validGroups = useMemo(() => {
        const nodeSet = new Set(nodeGroups)
        return availableGroups.filter(g => !nodeSet.has(g))
    }, [availableGroups, nodeGroups])

    const [materials, setMaterials] = useState<Material[]>([])
    const lastInitializedPath = useRef<string | null>(null)

    // Sync from props only on project change or initial load
    useEffect(() => {
        if (!projectPath) return

        // Se mudou de projeto ou ainda não inicializou
        if (lastInitializedPath.current !== projectPath) {
            if (initialMaterials && initialMaterials.length > 0) {
                const formatted = initialMaterials.map((m, index) => ({
                    id: (index + 1).toString(),
                    name: m.name,
                    E: (m.E / 1e6).toString(), // Pa to MPa
                    nu: (m.nu || 0).toString(),
                    rho: (m.rho || 0).toString(),
                    assignedGroups: m.assignedGroups || []
                }))
                setMaterials(formatted)
                lastInitializedPath.current = projectPath
            } else if (materials.length === 0) {
                // Default if empty
                setMaterials([{ id: '1', name: 'Steel_S355', E: '210000', nu: '0.3', rho: '7850', assignedGroups: [] }])
                lastInitializedPath.current = projectPath
            }
        }
    }, [projectPath, initialMaterials])

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        if (onUpdate) {
            const exportData = materials.map(m => ({
                name: m.name,
                E: parseFloat(m.E) * 1e6, // MPa to Pa
                nu: parseFloat(m.nu),
                rho: parseFloat(m.rho),
                assignedGroups: m.assignedGroups
            }))
            onUpdate(exportData)
        }
    }, [materials, onUpdate])

    const addMaterial = () => {
        const newId = (materials.length + 1).toString()
        setMaterials([
            ...materials,
            {
                id: newId,
                name: `Material_${newId}`,
                E: '210000',
                nu: '0.3',
                rho: '7850',
                assignedGroups: []
            }
        ])
    }

    const removeMaterial = (id: string) => {
        if (materials.length === 1) {
            alert('At least one material is required')
            return
        }
        setMaterials(materials.filter(m => m.id !== id))
    }

    const updateMaterial = (id: string, field: keyof Material, value: any) => {
        setMaterials(
            materials.map(m => (m.id === id ? { ...m, [field]: value } : m))
        )
    }

    const toggleGroup = (materialId: string, groupName: string) => {
        const material = materials.find(m => m.id === materialId)
        if (!material) return

        const currentGroups = material.assignedGroups || []
        const newGroups = currentGroups.includes(groupName)
            ? currentGroups.filter(g => g !== groupName)
            : [...currentGroups, groupName]

        updateMaterial(materialId, 'assignedGroups', newGroups)
    }

    if (!projectPath) {
        return <div className="p-10 text-center text-slate-500">Please select a project.</div>
    }

    return (
        <div className="flex flex-col h-full w-full p-4 overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                        <span className="p-2 bg-blue-500/20 rounded text-blue-400">⚙️</span>
                        Material Properties
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">Define properties and assign them to mesh groups.</p>
                </div>
                <button
                    onClick={addMaterial}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    Add Material
                </button>
            </div>

            {/* Materials List */}
            <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {materials.map((material) => (
                    <div
                        key={material.id}
                        className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 shadow-xl hover:border-slate-600/50 transition-colors"
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex-1 max-w-md">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-1">
                                    Material Identification
                                </label>
                                <input
                                    type="text"
                                    value={material.name}
                                    onChange={(e) => updateMaterial(material.id, 'name', e.target.value)}
                                    className="w-full text-xl font-bold bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                    placeholder="Ex: Steel S355"
                                />
                            </div>
                            <button
                                onClick={() => removeMaterial(material.id)}
                                className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all ml-4"
                                title="Delete Material"
                                disabled={materials.length === 1}
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            {/* Young's Modulus */}
                            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/30">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                                    Young's Modulus E (MPa)
                                </label>
                                <input
                                    type="text"
                                    value={material.E}
                                    onChange={(e) => updateMaterial(material.id, 'E', e.target.value)}
                                    className="w-full bg-transparent text-lg font-mono text-blue-300 focus:outline-none"
                                    placeholder="210000"
                                />
                            </div>

                            {/* Poisson's Ratio */}
                            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/30">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                                    Poisson's Ratio ν
                                </label>
                                <input
                                    type="text"
                                    value={material.nu}
                                    onChange={(e) => updateMaterial(material.id, 'nu', e.target.value)}
                                    className="w-full bg-transparent text-lg font-mono text-blue-300 focus:outline-none"
                                    placeholder="0.30"
                                />
                            </div>

                            {/* Density */}
                            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/30">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                                    Density ρ (kg/m³)
                                </label>
                                <input
                                    type="text"
                                    value={material.rho}
                                    onChange={(e) => updateMaterial(material.id, 'rho', e.target.value)}
                                    className="w-full bg-transparent text-lg font-mono text-blue-300 focus:outline-none"
                                    placeholder="7850"
                                />
                            </div>
                        </div>

                        {/* Group Assignment Section */}
                        <div className="border-t border-slate-700/50 pt-6">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Layers className="w-3.5 h-3.5" />
                                Assigned Groups (Beams, Shells, Solids)
                            </h4>

                            {validGroups.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {validGroups.map(group => {
                                        const isAssigned = (material.assignedGroups || []).includes(group)
                                        // Verificar se já está em outro material
                                        const isTaken = materials.some(m => m.id !== material.id && m.assignedGroups.includes(group))

                                        return (
                                            <button
                                                key={group}
                                                disabled={isTaken}
                                                onClick={() => toggleGroup(material.id, group)}
                                                className={`
                                                    px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-2
                                                    ${isAssigned
                                                        ? 'bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/20'
                                                        : isTaken
                                                            ? 'bg-slate-800/30 border-slate-800 text-slate-700 cursor-not-allowed opacity-50'
                                                            : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                                                    }
                                                `}
                                            >
                                                {isAssigned ? '✓' : ''}
                                                {group}
                                                {isTaken && <span className="text-[9px] opacity-70">(Used)</span>}
                                            </button>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="bg-slate-900/30 border border-dashed border-slate-700 rounded-xl p-4 text-center">
                                    <p className="text-xs text-slate-500 italic">No mesh groups detected. Please open a project with valid mesh files.</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
