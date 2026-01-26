import { useState, useEffect, useRef, useMemo } from 'react'
import {
    Check,
    X,
    Box,
    Layers,
    Search,
    ChevronRight,
    Settings2,
    Activity,
    Database,
    AlertCircle
} from 'lucide-react'

interface MeshGroup {
    name: string
    meshFile: string
    selected: boolean
    count: number
    composition: string
    category: string
    model: string
    phenomenon: string
}

interface ModelConfigProps {
    projectPath: string | null
    meshGroups?: any
    currentGeometries?: any[]
    onUpdate?: (geometries: any[]) => void
}

const MODEL_OPTIONS = {
    '1D': [
        { value: 'POU_D_T', label: 'Beam (Timoshenko) - POU_D_T' },
        { value: 'POU_D_E', label: 'Beam (Euler) - POU_D_E' },
        { value: 'BARRE', label: 'Truss/Bar - BARRE' },
        { value: 'CABLE', label: 'Cable - CABLE' }
    ],
    '2D': [
        { value: 'DKT', label: 'Plate (Thin) - DKT' },
        { value: 'DST', label: 'Plate (Thick) - DST' },
        { value: 'COQUE_3D', label: 'Shell 3D - COQUE_3D' },
        { value: 'MEMBRANE', label: 'Membrane - MEMBRANE' },
        { value: 'C_PLAN', label: 'Plane Strain - C_PLAN' },
        { value: 'D_PLAN', label: 'Plane Stress - D_PLAN' },
        { value: 'AXIS', label: 'Axisymmetric - AXIS' }
    ],
    '3D': [
        { value: '3D', label: 'Solid/Volume - 3D' }
    ]
}

const CATEGORY_COLORS: Record<string, string> = {
    '1D': 'text-orange-500 border-orange-500/30 bg-orange-500/10',
    '2D': 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
    '3D': 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
    'Node': 'text-slate-500 border-slate-500/30 bg-slate-500/10',
}

export default function ModelConfig({ projectPath, meshGroups, currentGeometries = [], onUpdate }: ModelConfigProps) {
    const [groups, setGroups] = useState<MeshGroup[]>([])
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterCategory, setFilterCategory] = useState<string | 'all'>('all')

    const isFirstRender = useRef(true)
    const lastGroupsSignatureRef = useRef<string>('')
    const lastExportSignatureRef = useRef<string>('')

    // Auto-select first group if none selected
    useEffect(() => {
        if (!selectedGroupId && groups.length > 0) {
            setSelectedGroupId(`${groups[0].meshFile}:${groups[0].name}`)
        }
    }, [groups, selectedGroupId])

    // Sync groups from props
    useEffect(() => {
        if (meshGroups) {
            const signature = JSON.stringify(Object.entries(meshGroups).map(([file, groups]: [string, any]) => ({
                file,
                groups: Object.keys(groups).sort()
            })))

            if (signature === lastGroupsSignatureRef.current) return
            lastGroupsSignatureRef.current = signature

            const loadedGroups: MeshGroup[] = []
            Object.entries(meshGroups).forEach(([fileName, groupsInFile]: [string, any]) => {
                Object.entries(groupsInFile).forEach(([groupName, info]: [string, any]) => {
                    const category = info.category || detectCategory(info.types || {})
                    if (category === 'Node' || category === 'Point') return

                    const compStr = info.types ? Object.entries(info.types)
                        .map(([t, q]) => `${t}:${q}`)
                        .join(', ') : category

                    const existingConfig = currentGeometries.find((c: any) => c.group === groupName && c._meshFile === fileName)

                    loadedGroups.push({
                        name: groupName,
                        meshFile: fileName,
                        selected: currentGeometries.length > 0 ? !!existingConfig : true,
                        count: info.count,
                        composition: compStr,
                        category: category,
                        model: existingConfig?.type || detectDefaultModel(category),
                        phenomenon: 'MECANIQUE'
                    })
                })
            })
            setGroups(loadedGroups)
        }
    }, [meshGroups, currentGeometries])

    // Propagate up
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        if (onUpdate) {
            const exportData = groups
                .filter(g => g.selected)
                .map(g => ({
                    group: g.name,
                    _meshFile: g.meshFile,
                    ...(() => {
                        const existing = currentGeometries.find(c => c.group === g.name && c._meshFile === g.meshFile) || {}
                        return {
                            ...existing,
                            type: g.model,
                            formulation: (g.model === 'DKT' || g.model === 'DST') ? g.model : undefined,
                            phenomenon: 'MECANIQUE',
                            _category: g.category
                        }
                    })()
                }))

            const expSignature = JSON.stringify(exportData)
            if (expSignature !== lastExportSignatureRef.current) {
                lastExportSignatureRef.current = expSignature
                onUpdate(exportData)
            }
        }
    }, [groups, onUpdate])

    const detectCategory = (typesObj: any): string => {
        const types = Object.keys(typesObj)
        if (types.some(t => t === 'Node')) return 'Node'
        if (types.some(t => t.includes('HEXA') || t.includes('TETRA') || t.includes('PENTA'))) return '3D'
        if (types.some(t => t.includes('QUAD') || t.includes('TRIA'))) return '2D'
        if (types.some(t => t.includes('SEG'))) return '1D'
        return '3D'
    }

    const detectDefaultModel = (category: string): string => {
        if (category === 'Node') return 'Node'
        if (category === '3D') return '3D'
        if (category === '2D') return 'COQUE_3D'
        if (category === '1D') return 'POU_D_T'
        return '3D'
    }

    const handleCheckboxChange = (meshFile: string, name: string) => {
        setGroups(prev => prev.map(g =>
            (g.meshFile === meshFile && g.name === name) ? { ...g, selected: !g.selected } : g
        ))
    }

    const handleModelChange = (meshFile: string, name: string, newModel: string) => {
        setGroups(prev => prev.map(g =>
            (g.meshFile === meshFile && g.name === name) ? { ...g, model: newModel } : g
        ))
    }

    const toggleAll = (select: boolean) => {
        setGroups(groups.map(g => ({ ...g, selected: select })))
    }

    const filteredGroups = useMemo(() => {
        return groups.filter(g => {
            const matchesSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase())
            const matchesCategory = filterCategory === 'all' || g.category === filterCategory
            return matchesSearch && matchesCategory
        })
    }, [groups, searchTerm, filterCategory])

    const selectedGroup = useMemo(() => {
        if (!selectedGroupId) return null
        const [file, name] = selectedGroupId.split(':')
        return groups.find(g => g.meshFile === file && g.name === name) || null
    }, [groups, selectedGroupId])

    if (!projectPath) return <div className="p-10 text-center text-slate-500 font-mono tracking-tighter uppercase italic">waiting_for_payload: select_project</div>

    if (groups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-10 bg-slate-950 border border-dashed border-slate-800 rounded-none overflow-hidden relative">
                <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat" />
                <div className="text-4xl mb-4 grayscale filter">🕸️</div>
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Null_Structure_Detected</h3>
                <p className="mb-6 text-center max-w-xs text-[10px] text-slate-600 font-mono">Mesh topology sync failed or no groups found in the current workspace.</p>
            </div>
        )
    }

    return (
        <div className="flex h-full w-full bg-slate-950 border border-slate-800 rounded-none overflow-hidden font-sans">
            {/* Master: Side List */}
            <div className="w-[320px] shrink-0 border-r border-slate-800 flex flex-col bg-slate-900/10">
                <div className="p-4 border-b border-slate-800 bg-slate-900/30">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-cyan-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Mesh_Groups</span>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => toggleAll(true)} title="Check All" className="p-1 hover:bg-slate-800 text-slate-500 hover:text-cyan-400 transition-colors"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => toggleAll(false)} title="Uncheck All" className="p-1 hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                            <input
                                type="text"
                                placeholder="Filter identifier..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-none pl-9 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                            />
                        </div>
                        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                            {['all', '1D', '2D', '3D'].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setFilterCategory(cat)}
                                    className={`
                                        px-2 py-1 text-[9px] font-black uppercase border transition-all
                                        ${filterCategory === cat
                                            ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400'
                                            : 'bg-transparent border-slate-800 text-slate-600 hover:text-slate-400'}
                                    `}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {filteredGroups.map((g) => {
                        const id = `${g.meshFile}:${g.name}`
                        const isActive = selectedGroupId === id
                        const colorClass = CATEGORY_COLORS[g.category] || 'text-slate-400'

                        return (
                            <div
                                key={id}
                                onClick={() => setSelectedGroupId(id)}
                                className={`
                                    relative group p-3 mb-1 cursor-pointer border transition-all flex items-center gap-3
                                    ${isActive
                                        ? 'bg-cyan-500/5 border-cyan-500/30'
                                        : 'bg-transparent border-transparent hover:bg-slate-800/40'}
                                    ${!g.selected ? 'opacity-40 grayscale-[0.6]' : ''}
                                `}
                            >
                                <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${isActive ? 'bg-cyan-500' : 'bg-transparent'}`} />
                                <input
                                    type="checkbox"
                                    checked={g.selected}
                                    onChange={(e) => { e.stopPropagation(); handleCheckboxChange(g.meshFile, g.name); }}
                                    className="w-3 h-3 accent-cyan-500 bg-slate-900 border-slate-800 rounded-none shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-xs font-black truncate pr-2 ${isActive ? 'text-white' : 'text-slate-400'}`}>
                                            {g.name}
                                        </span>
                                        <span className={`text-[8px] px-1 border font-bold ${colorClass}`}>
                                            {g.category}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[9px] font-mono text-slate-600 uppercase">
                                        <span className="truncate max-w-[120px]" title={g.meshFile}>{g.meshFile}</span>
                                        <span>{g.count} el.</span>
                                    </div>
                                </div>
                                <ChevronRight className={`w-4 h-4 transition-all ${isActive ? 'text-cyan-400' : 'text-slate-800 opacity-0 group-hover:opacity-100'}`} />
                            </div>
                        )
                    })}
                </div>

                <div className="p-2 border-t border-slate-800 bg-slate-900/30 text-[9px] font-mono text-slate-600 flex justify-between uppercase">
                    <span>Total: {groups.length}</span>
                    <span>Active: {groups.filter(x => x.selected).length}</span>
                </div>
            </div>

            {/* Detail: Inspector */}
            <div className="flex-1 flex flex-col relative bg-slate-950">
                <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat" />

                {selectedGroup ? (
                    <>
                        <div className="h-20 shrink-0 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/10">
                            <div className="flex items-center gap-6">
                                <div className={`p-4 border ${CATEGORY_COLORS[selectedGroup.category]}`}>
                                    <Box className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Entity_Group</span>
                                        <div className={`w-1.5 h-1.5 rounded-full ${selectedGroup.selected ? 'bg-cyan-500 animate-pulse' : 'bg-slate-700'}`} />
                                    </div>
                                    <h3 className="text-xl font-black text-white leading-none font-mono">
                                        {selectedGroup.name}
                                    </h3>
                                </div>
                            </div>

                            <div className="flex gap-4 items-center">
                                <div className="text-right">
                                    <span className="block text-[8px] font-black text-slate-600 uppercase tracking-widest">Source_File</span>
                                    <span className="text-[10px] font-mono text-slate-400">{selectedGroup.meshFile}</span>
                                </div>
                                <div className="h-8 w-[1px] bg-slate-800 mx-2" />
                                <div className={`px-3 py-1.5 border ${CATEGORY_COLORS[selectedGroup.category]} font-black text-[10px] uppercase`}>
                                    Dim: {selectedGroup.category}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                            <div className="max-w-3xl">
                                <div className="grid grid-cols-2 gap-12 mb-12">
                                    <div className="space-y-8">
                                        <section>
                                            <div className="flex items-center gap-2 mb-4">
                                                <Settings2 className="w-3.5 h-3.5 text-cyan-500" />
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Model_Specification</h4>
                                            </div>
                                            <div className="bg-slate-900/40 border border-slate-800 p-1">
                                                <select
                                                    value={selectedGroup.model}
                                                    onChange={(e) => handleModelChange(selectedGroup.meshFile, selectedGroup.name, e.target.value)}
                                                    disabled={!selectedGroup.selected}
                                                    className={`
                                                        w-full bg-slate-950 text-xs font-bold text-white p-3 focus:outline-none transition-all
                                                        ${!selectedGroup.selected ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-900 border-l-2 border-l-cyan-500'}
                                                    `}
                                                >
                                                    {selectedGroup.category === '3D' && (
                                                        <optgroup label="Solid (Volume) Formulation">
                                                            {MODEL_OPTIONS['3D'].map(op => (
                                                                <option key={op.value} value={op.value}>{op.label}</option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    {selectedGroup.category === '2D' && (
                                                        <optgroup label="Plate/Shell Formulation">
                                                            {MODEL_OPTIONS['2D'].map(op => (
                                                                <option key={op.value} value={op.value}>{op.label}</option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    {selectedGroup.category === '1D' && (
                                                        <optgroup label="Beam/Truss Formulation">
                                                            {MODEL_OPTIONS['1D'].map(op => (
                                                                <option key={op.value} value={op.value}>{op.label}</option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                </select>
                                            </div>
                                            <p className="mt-4 text-[10px] text-slate-600 italic font-mono leading-relaxed">
                                                The mathematical formulation determines how the integration points and degrees of freedom are evaluated during simulation.
                                            </p>
                                        </section>

                                        <section className="bg-slate-900/20 border-l border-l-slate-800 p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Activity className="w-3 h-3 text-slate-500" />
                                                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Physics_Engine</h4>
                                            </div>
                                            <div className="text-xs font-bold text-slate-300">PHENOMENE = 'MECANIQUE'</div>
                                            <div className="text-[9px] text-slate-600 mt-1 uppercase font-mono">Standard linear elastic solver</div>
                                        </section>
                                    </div>

                                    <div className="space-y-8">
                                        <section>
                                            <div className="flex items-center gap-2 mb-4">
                                                <Database className="w-3.5 h-3.5 text-slate-500" />
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Internal_Topology</h4>
                                            </div>
                                            <div className="p-4 border border-slate-800 bg-slate-900/10">
                                                <div className="flex justify-between items-end mb-4">
                                                    <div>
                                                        <span className="block text-[8px] font-bold text-slate-600 uppercase">Elem_Count</span>
                                                        <span className="text-2xl font-black text-white font-mono leading-none">{selectedGroup.count}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="block text-[8px] font-bold text-slate-600 uppercase">Integration_Degree</span>
                                                        <span className="text-xs font-bold text-cyan-400 uppercase">Linear / P1</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="block text-[8px] font-bold text-slate-600 uppercase mb-2">Structure_Composition</span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {selectedGroup.composition.split(',').map(part => (
                                                            <span key={part} className="px-1.5 py-0.5 bg-slate-800 text-slate-400 font-mono text-[9px] border border-slate-700">{part.trim()}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </section>

                                        <div className="bg-orange-500/5 border border-orange-500/20 p-4">
                                            <div className="flex items-start gap-3">
                                                <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                                                <div>
                                                    <h5 className="text-[10px] font-black text-orange-400 uppercase mb-1 leading-none tracking-widest">Automated_Check</h5>
                                                    <p className="text-[9px] text-orange-500/80 leading-relaxed italic">
                                                        Ensuring connectivity matches the {selectedGroup.category} logic.
                                                        Warning: Inconsistent dimension formulations will cause job termination.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-20 filter grayscale">
                        <Search className="w-12 h-12 text-slate-500 mb-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">awaiting_selection</span>
                    </div>
                )}
            </div>
        </div>
    )
}
