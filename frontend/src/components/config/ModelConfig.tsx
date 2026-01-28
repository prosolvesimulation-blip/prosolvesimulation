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
import modelOptionsData from '../../data/modelOptions.json'

type PhysicsApplication = 'MECANIQUE' | 'THERMIQUE' | 'ACOUSTIQUE'

interface ModelOption {
    value: string
    label: string
    category: string
}

interface PhysicsDomain {
    application: PhysicsApplication
    label: string
    models: {
        [dimension: string]: ModelOption[]
    }
}

interface MeshGroup {
    name: string
    meshFile: string
    selected: boolean
    count: number
    composition: string
    category: string
    model: string
    phenomenon: string
    medType?: string // NEW
}

interface ModelConfigProps {
    projectPath: string | null
    meshGroups?: any
    currentGeometries?: any[]
    onUpdate?: (geometries: any[]) => void
}

const ELEMENT_TYPE_MAP: Record<string, '1D' | '2D' | '3D'> = {
    // 1D Elements
    'SEG': '1D',
    'POU_D': '1D', 
    'BARRE': '1D',
    'CABLE': '1D',
    
    // 2D Elements  
    'QUAD': '2D',
    'TRIA': '2D',
    'DKT': '2D',
    'DST': '2D',
    'COQUE': '2D',
    'MEMBRANE': '2D',
    
    // 3D Elements
    'HEXA': '3D',
    'TETRA': '3D', 
    'PENTA': '3D'
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

    // Physics detection and filtering functions
    const getAvailablePhysicsForElementType = (medType: string): PhysicsApplication[] => {
        const physicsMap: Record<string, PhysicsApplication[]> = {
            // Beam elements
            'SEG': ['MECANIQUE', 'THERMIQUE'],
            'POU_D': ['MECANIQUE'],
            'BARRE': ['MECANIQUE'],
            'CABLE': ['MECANIQUE'],
            
            // Shell elements  
            'QUAD': ['MECANIQUE', 'THERMIQUE', 'ACOUSTIQUE'],
            'TRIA': ['MECANIQUE', 'THERMIQUE', 'ACOUSTIQUE'],
            'DKT': ['MECANIQUE'],
            'DST': ['MECANIQUE'],
            'COQUE': ['MECANIQUE', 'THERMIQUE'],
            'MEMBRANE': ['MECANIQUE', 'THERMIQUE'],
            
            // Solid elements
            'HEXA': ['MECANIQUE', 'THERMIQUE', 'ACOUSTIQUE'],
            'TETRA': ['MECANIQUE', 'THERMIQUE', 'ACOUSTIQUE'],
            'PENTA': ['MECANIQUE', 'THERMIQUE', 'ACOUSTIQUE'],
            
            // Special cases
            'AXIS': ['MECANIQUE', 'THERMIQUE']
        }
        
        // Find matching physics for this element type
        for (const [element, physics] of Object.entries(physicsMap)) {
            if (medType.includes(element)) {
                return physics
            }
        }
        
        return ['MECANIQUE'] // Default fallback
    }

    const getFilteredModelOptionsByElementType = (
        physics: PhysicsApplication, 
        medType: string, 
        fallbackCategory: string
    ): ModelOption[] => {
        // Determine the validated category
        const validatedCategory = getValidatedCategory(medType, fallbackCategory)
        
        // Get models from JSON for this category
        const physicsDomain = (modelOptionsData as PhysicsDomain[]).find(p => p.application === physics)
        const availableModels = physicsDomain?.models[validatedCategory] || []
        
        // Additional filtering based on specific element type
        return availableModels.filter(model => {
            const modelValue = model.value.toUpperCase()
            const medTypeUpper = medType.toUpperCase()
            
            // Specific element type restrictions
            if (medTypeUpper.includes('SEG')) {
                return ['POU_D_T', 'POU_D_E', 'BARRE', 'CABLE'].includes(modelValue)
            }
            
            if (medTypeUpper.includes('QUAD') || medTypeUpper.includes('TRIA')) {
                return ['DKT', 'DST', 'COQUE_3D', 'MEMBRANE', 'C_PLAN', 'D_PLAN', 'AXIS'].includes(modelValue)
            }
            
            if (medTypeUpper.includes('HEXA') || medTypeUpper.includes('TETRA')) {
                return modelValue === '3D' || modelValue.startsWith('3D_')
            }
            
            // Thermal models
            if (physics === 'THERMIQUE') {
                return modelValue.includes('PLAN') || modelValue.includes('AXIS') || 
                       modelValue.includes('COQUE') && modelValue !== 'COQUE_3D'
            }
            
            return true // Default: allow all models for this category
        })
    }

    const getValidatedCategory = (medType: string, fallbackCategory: string): string => {
        if (!medType) return fallbackCategory
        
        // Try to determine category from MED type first
        const medTypeBase = medType.split('_')[0]
        const medCategory = ELEMENT_TYPE_MAP[medTypeBase]
        if (medCategory) return medCategory
        
        // Fallback to existing detection logic
        return fallbackCategory
    }

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
                    const basicCategory = info.category || detectCategory(info.types || {})
                    if (basicCategory === 'Node' || basicCategory === 'Point') return

                    const compStr = (info.types && Object.keys(info.types).length > 0)
                        ? Object.entries(info.types)
                            .map(([t, q]) => `${t}:${q}`)
                            .join(', ')
                        : basicCategory

                    const existingConfig = currentGeometries.find((c: any) => c.group === groupName && c._meshFile === fileName)
                    
                    // Use validated category based on MED type
                    const validatedCategory = getValidatedCategory(info.med_type, basicCategory)

                    loadedGroups.push({
                        name: groupName,
                        meshFile: fileName,
                        selected: currentGeometries.length > 0 ? !!existingConfig : true,
                        count: info.count,
                        composition: compStr,
                        category: validatedCategory, // Use validated category
                        model: existingConfig?.type || detectDefaultModel(validatedCategory),
                        phenomenon: existingConfig?.phenomenon || 'MECANIQUE', // Use existing or default
                        medType: info.med_type // NEW
                    })
                })
            })
            console.log("DEBUG: [ModelConfig] Loaded groups with types:", loadedGroups.map(g => ({ 
                name: g.name, 
                medType: g.medType, 
                category: g.category, 
                validatedCategory: getValidatedCategory(g.medType || '', g.category)
            })))
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
                            phenomenon: g.phenomenon, // Use dynamic physics instead of hardcoded
                            _category: g.category,
                            section_type: g.category === '1D' ? 'BEAM' : g.category === '2D' ? 'SHELL' : g.category === '3D' ? 'SOLID' : undefined
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

    const handlePhysicsChange = (meshFile: string, name: string, newPhysics: PhysicsApplication) => {
        setGroups(prev => prev.map(g => {
            if (g.meshFile === meshFile && g.name === name) {
                const availableModels = getFilteredModelOptionsByElementType(newPhysics, g.medType || '', g.category)
                const currentModelValid = availableModels.some(m => m.value === g.model)
                const newModel = currentModelValid ? g.model : availableModels[0]?.value || ''
                
                return {
                    ...g,
                    phenomenon: newPhysics,
                    model: newModel
                }
            }
            return g
        }))
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

    if (!projectPath) return (
        <div className="flex flex-col items-center justify-center h-full p-10 bg-[#0B0F19] text-slate-500 font-mono relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.02] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
            <div className="z-10 bg-slate-900/50 p-8 rounded-full mb-6 border border-white/5 shadow-2xl">
                <Search size={40} className="text-slate-700" />
            </div>
            <span className="text-xs font-black tracking-[0.4em] uppercase text-slate-600 mb-2">Workspace_Inactive</span>
            <p className="text-[10px] opacity-50">Select a project to inspect geometry</p>
        </div>
    )

    if (groups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-10 bg-[#0B0F19] border border-dashed border-slate-800/50 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat" />
                <div className="relative z-10 text-center">
                    <div className="inline-flex p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-black border border-white/5 shadow-2xl mb-6">
                        <Layers size={32} className="text-slate-700" />
                    </div>
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Topology_Missing</h3>
                    <p className="max-w-xs mx-auto text-[10px] text-slate-600 font-mono leading-relaxed">
                        No mesh groups detected. Ensure your <span className="text-slate-500">.med</span> file contains named groups for classification.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full w-full bg-[#0B0F19] font-sans overflow-hidden">
            {/* Master: Side List */}
            <div className="w-[340px] shrink-0 border-r border-white/5 flex flex-col bg-[#0F1218]">
                <div className="p-5 border-b border-white/5">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-cyan-500/10 rounded-md">
                                <Layers className="w-4 h-4 text-cyan-400" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Mesh_Groups</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => toggleAll(true)} title="Check All" className="p-1.5 rounded-md hover:bg-white/5 text-slate-500 hover:text-cyan-400 transition-colors"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => toggleAll(false)} title="Uncheck All" className="p-1.5 rounded-md hover:bg-white/5 text-slate-500 hover:text-rose-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="relative group">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-cyan-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Filter by identifier..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-black/20 border border-white/5 rounded-lg pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-slate-700 focus:outline-none focus:border-cyan-500/30 transition-all font-mono"
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                            {['all', '1D', '2D', '3D'].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setFilterCategory(cat)}
                                    className={`
                                        px-3 py-1.5 text-[9px] font-black uppercase rounded-md border transition-all
                                        ${filterCategory === cat
                                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                                            : 'bg-transparent border-white/5 text-slate-600 hover:text-slate-400 hover:bg-white/5'}
                                    `}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                    {filteredGroups.map((g) => {
                        const id = `${g.meshFile}:${g.name}`
                        const isActive = selectedGroupId === id
                        const colorClass = CATEGORY_COLORS[g.category] || 'text-slate-400'

                        return (
                            <div
                                key={id}
                                onClick={() => setSelectedGroupId(id)}
                                className={`
                                    relative p-3 rounded-xl cursor-pointer border transition-all duration-200 flex items-center gap-3 group
                                    ${isActive
                                        ? 'bg-cyan-500/5 border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.05)]'
                                        : 'bg-transparent border-transparent hover:bg-white/5'}
                                    ${!g.selected ? 'opacity-50 grayscale' : ''}
                                `}
                            >
                                <input
                                    type="checkbox"
                                    checked={g.selected}
                                    onChange={(e) => { e.stopPropagation(); handleCheckboxChange(g.meshFile, g.name); }}
                                    className="w-3.5 h-3.5 accent-cyan-500 bg-black/40 border-white/10 rounded cursor-pointer transition-transform hover:scale-110"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className={`text-[11px] font-black truncate pr-2 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>
                                            {g.name}
                                        </span>
                                        <span className={`text-[7px] px-1.5 py-0.5 rounded border bg-opacity-10 backdrop-blur-sm tracking-wide font-black ${colorClass.replace('bg-', 'bg-opacity-10 ')}`}>
                                            {g.category}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[8px] font-mono leading-none mt-1">
                                        <span className="text-slate-600 truncate max-w-[70px]" title={g.meshFile}>{g.meshFile}</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-800 shrink-0" />
                                        <span className="text-cyan-500 font-bold truncate max-w-[80px]" title={g.composition}>{g.composition}</span>
                                        {g.medType && (
                                            <>
                                                <span className="w-1 h-1 rounded-full bg-slate-800 shrink-0" />
                                                <div className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded-md">
                                                    <span className="text-emerald-400 font-black uppercase text-[9px] tracking-wider">{g.medType}</span>
                                                </div>
                                            </>
                                        )}
                                        <div className="flex-1" />
                                        <span className="text-slate-500 font-black shrink-0">{g.count} EL.</span>
                                    </div>
                                </div>
                                {isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-cyan-500 rounded-l-full shadow-[0_0_10px_rgba(6,182,212,0.5)]" />}
                            </div>
                        )
                    })}
                </div>

                <div className="p-3 border-t border-white/5 bg-[#0A0C10] text-[9px] font-mono text-slate-600 flex justify-between uppercase tracking-wider">
                    <span>Groups Detected: {groups.length}</span>
                    <span className={groups.some(g => g.selected) ? 'text-cyan-600' : ''}>Active: {groups.filter(x => x.selected).length}</span>
                </div>
            </div>

            {/* Detail: Inspector */}
            <div className="flex-1 flex flex-col relative bg-[#0B0F19]">
                <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat" />

                {selectedGroup ? (
                    <>
                        <div className="h-24 shrink-0 border-b border-white/5 flex items-center justify-between px-10 bg-gradient-to-r from-slate-900/50 to-transparent">
                            <div className="flex items-center gap-6">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border bg-opacity-5 ${CATEGORY_COLORS[selectedGroup.category]}`}>
                                    <Box className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Selected_Entity</span>
                                        {selectedGroup.selected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />}
                                    </div>
                                    <h3 className="text-2xl font-black text-white leading-none tracking-tight">
                                        {selectedGroup.name}
                                    </h3>
                                </div>
                            </div>

                            <div className="flex gap-8 items-center">
                                <div className="text-right">
                                    <span className="block text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Source Filter</span>
                                    <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-1 rounded">{selectedGroup.meshFile}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                            <div className="max-w-4xl">
                                <div className="grid grid-cols-5 gap-8 mb-12">
                                    {/* Left Column: Configuration */}
                                    <div className="col-span-3 space-y-8">
                                        <section className="bg-slate-900/30 border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-cyan-500/20 transition-colors">
                                            <div className="absolute top-0 right-0 p-20 bg-cyan-500/5 blur-[60px] rounded-full group-hover:bg-cyan-500/10 transition-all" />

                                            <div className="flex items-center gap-3 mb-6 relative z-10">
                                                <div className="p-2 bg-slate-950 rounded-lg border border-white/10">
                                                    <Settings2 className="w-4 h-4 text-cyan-400" />
                                                </div>
                                                <div>
                                                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Physics Formulation</h4>
                                                    <p className="text-[9px] text-slate-500">Mathematical Strategy</p>
                                                </div>
                                            </div>

                                            <div className="relative z-10">
                                                <select
                                                    value={selectedGroup.phenomenon}
                                                    onChange={(e) => handlePhysicsChange(selectedGroup.meshFile, selectedGroup.name, e.target.value as PhysicsApplication)}
                                                    disabled={!selectedGroup.selected}
                                                    className="w-full bg-[#0B0F19] text-sm font-bold text-white p-4 rounded-xl border border-white/10 focus:outline-none focus:border-cyan-500/50 appearance-none transition-all mb-4"
                                                >
                                                    {getAvailablePhysicsForElementType(selectedGroup.medType || '').map(physics => {
                                                        const domain = (modelOptionsData as PhysicsDomain[]).find(p => p.application === physics)
                                                        return (
                                                            <option key={physics} value={physics}>
                                                                {domain?.label || physics}
                                                            </option>
                                                        )
                                                    })}
                                                </select>
                                                <div className="absolute right-4 top-[84px] pointer-events-none text-slate-500">
                                                    <ChevronRight size={14} className="rotate-90" />
                                                </div>
                                            </div>
                                        </section>

                                        <section className="bg-slate-900/30 border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-cyan-500/20 transition-colors">
                                            <div className="absolute top-0 right-0 p-20 bg-cyan-500/5 blur-[60px] rounded-full group-hover:bg-cyan-500/10 transition-all" />

                                            <div className="flex items-center gap-3 mb-6 relative z-10">
                                                <div className="p-2 bg-slate-950 rounded-lg border border-white/10">
                                                    <Settings2 className="w-4 h-4 text-cyan-400" />
                                                </div>
                                                <div>
                                                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Model Selection</h4>
                                                    <p className="text-[9px] text-slate-500">Element: {selectedGroup.medType || selectedGroup.category}</p>
                                                </div>
                                            </div>

                                            <div className="relative z-10">
                                                <select
                                                    value={selectedGroup.model}
                                                    onChange={(e) => handleModelChange(selectedGroup.meshFile, selectedGroup.name, e.target.value)}
                                                    disabled={!selectedGroup.selected}
                                                    className={`
                                                        w-full bg-[#0B0F19] text-sm font-bold text-white p-4 rounded-xl border border-white/10 focus:outline-none focus:border-cyan-500/50 appearance-none transition-all
                                                        ${!selectedGroup.selected ? 'opacity-40 cursor-not-allowed' : 'hover:border-white/20'}
                                                    `}
                                                >
                                                    {(() => {
                                                        const availableModels = getFilteredModelOptionsByElementType(
                                                            selectedGroup.phenomenon as PhysicsApplication, 
                                                            selectedGroup.medType || '',
                                                            selectedGroup.category
                                                        )
                                                        return availableModels.length > 0 && (
                                                            <optgroup label={`${selectedGroup.phenomenon} ${selectedGroup.medType || selectedGroup.category} Models`}>
                                                                {availableModels.map(op => (
                                                                    <option key={op.value} value={op.value}>{op.label}</option>
                                                                ))}
                                                            </optgroup>
                                                        )
                                                    })()}
                                                </select>
                                                <div className="absolute right-4 top-[84px] pointer-events-none text-slate-500">
                                                    <ChevronRight size={14} className="rotate-90" />
                                                </div>

                                                <div className="flex items-start gap-3 mt-4 p-3 rounded-lg bg-cyan-900/10 border border-cyan-500/10">
                                                    <Activity className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="text-[10px] font-bold text-cyan-200">
                                                            {selectedGroup.phenomenon === 'MECANIQUE' ? 'Mechanical' : 
                                                             selectedGroup.phenomenon === 'THERMIQUE' ? 'Thermal' : 'Acoustic'} Solver Active
                                                        </p>
                                                        <p className="text-[9px] text-cyan-500/70 mt-0.5">
                                                            {selectedGroup.phenomenon === 'MECANIQUE' ? 'Linear Elasticity' :
                                                             selectedGroup.phenomenon === 'THERMIQUE' ? 'Heat Transfer' : 'Wave Propagation'} 
                                                            applied to {selectedGroup.count} elements.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </section>
                                    </div>

                                    {/* Right Column: Statistics */}
                                    <div className="col-span-2 space-y-4">
                                        <div className="p-6 bg-slate-900/30 border border-white/5 rounded-2xl">
                                            <div className="flex items-center gap-2 mb-4 opacity-50">
                                                <Database className="w-3.5 h-3.5" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Mesh Metrics</span>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <span className="text-3xl font-light text-white">{selectedGroup.count}</span>
                                                    <span className="block text-[9px] text-slate-500 font-mono uppercase mt-1">Total Elements</span>
                                                </div>

                                                {selectedGroup.medType && (
                                                    <div className="pt-2">
                                                        <span className="block text-[8px] font-black text-slate-600 uppercase tracking-widest mb-2">Detected Element Type</span>
                                                        <div className="inline-flex px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                                            <span className="text-xl font-black text-emerald-400 tracking-tighter uppercase">{selectedGroup.medType}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="h-px bg-white/5" />
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedGroup.composition.split(',').map(part => (
                                                        <span key={part} className="px-2 py-1 bg-black/40 border border-white/5 rounded text-[9px] font-mono text-slate-400">{part.trim()}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {selectedGroup.category !== '3D' && (
                                            <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl flex gap-3">
                                                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                                                <div>
                                                    <h5 className="text-[10px] font-bold text-amber-200 uppercase mb-1">Thickness Required</h5>
                                                    <p className="text-[9px] text-amber-500/70 leading-relaxed">
                                                        GeometryConfig tab config required for sections/thickness.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                            <Search className="w-8 h-8 text-slate-500" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Awaiting Selection</span>
                    </div>
                )}
            </div>
        </div>
    )
}
