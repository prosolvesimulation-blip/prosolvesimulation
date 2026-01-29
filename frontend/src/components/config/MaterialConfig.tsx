import { useState, useEffect, useRef, useMemo } from 'react'
import {
    Plus,
    Trash2,
    Layers,
    Briefcase,
    Cpu,
    Database,
    ChevronRight,
    Search,
    AlertCircle,
    Info,
    Check,
    Code,
    Copy,
    ChevronDown,
    ChevronUp,
    Terminal
} from 'lucide-react'
import { materialIntelligence } from '../../lib/codeAster/builders/materialIntelligence'
import type { MaterialDefinition, MaterialCommandsResult } from '../../lib/codeAster/builders/materialIntelligence'

interface Material {
    id: string
    name: string
    E: string // Young's Modulus in MPa
    nu: string // Poisson's Ratio
    rho: string // Density in kg/m³
    assignedGroups: string[]
}

interface MaterialConfigProps {
    projectPath: string | null
    availableGroups?: string[]
    nodeGroups?: string[]
    meshGroups?: Record<string, any>
    initialMaterials?: any[]
    onUpdate?: (materials: any[]) => void
    onMaterialCommandsUpdate?: (commands: any) => void
}

const MATERIAL_PRESETS = [
    { name: 'Steel S235', E: '210000', nu: '0.3', rho: '7850' },
    { name: 'Steel S355', E: '210000', nu: '0.3', rho: '7850' },
    { name: 'Aluminum 6061', E: '70000', nu: '0.33', rho: '2710' },
    { name: 'Concrete C30', E: '32000', nu: '0.2', rho: '2400' },
    { name: 'Stainless Steel 304', E: '193000', nu: '0.29', rho: '8000' },
]

export default function MaterialConfig({
    projectPath,
    availableGroups = [],
    nodeGroups = [],
    initialMaterials = [],
    onUpdate,
    onMaterialCommandsUpdate
}: MaterialConfigProps) {
    const isFirstRender = useRef(true)
    const [materials, setMaterials] = useState<Material[]>([])
    const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null)
    const [groupFilter, setGroupFilter] = useState('')
    const [unitType, setUnitType] = useState<'MPa' | 'Pa'>('MPa')
    const [showCommPreview, setShowCommPreview] = useState(false)
    const [copiedToClipboard, setCopiedToClipboard] = useState(false)
    const lastInitializedPath = useRef<string | null>(null)

    // Filter valid groups (Exclude Nodes)
    const validGroups = useMemo(() => {
        const nodeSet = new Set(nodeGroups)
        return availableGroups.filter(g => !nodeSet.has(g))
    }, [availableGroups, nodeGroups])

    // Convert to MaterialDefinition format for intelligence
    const materialDefinitions: MaterialDefinition[] = useMemo(() => {
        return materials.map(mat => ({
            id: mat.id,
            name: mat.name,
            props: {
                E: parseFloat(mat.E), // Use exact input value without conversion
                NU: parseFloat(mat.nu),
                RHO: parseFloat(mat.rho)
            },
            assignedGroups: mat.assignedGroups || []
        }))
    }, [materials])

    // Generate Code_Aster commands
    const materialCommands: MaterialCommandsResult = useMemo(() => {
        return materialIntelligence.generateMaterialCommands(materialDefinitions)
    }, [materialDefinitions])
    
    // Update parent with material commands when they change
    useEffect(() => {
        if (onMaterialCommandsUpdate && materialCommands) {
            onMaterialCommandsUpdate(materialCommands)
        }
    }, [materialCommands, onMaterialCommandsUpdate])

    // Copy to clipboard functionality
    const copyToClipboard = async () => {
        const fullCommands = [
            '# --- 4. Definição de Materiais ---',
            ...materialCommands.defiCommands,
            '',
            '# --- 5. Atribuição de Materiais ---',
            ...materialCommands.affeCommands
        ].filter(Boolean).join('\n')
        
        try {
            await navigator.clipboard.writeText(fullCommands)
            setCopiedToClipboard(true)
            setTimeout(() => setCopiedToClipboard(false), 2000)
        } catch (err: any) {
            console.error('Failed to copy to clipboard:', err)
        }
    }

    // Coverage Stats
    const stats = useMemo(() => {
        const allAssigned = new Set(materials.flatMap(m => m.assignedGroups))
        const total = validGroups.length
        const assigned = allAssigned.size
        const percent = total > 0 ? Math.round((assigned / total) * 100) : 0
        return { total, assigned, percent }
    }, [materials, validGroups])

    const selectedMaterial = useMemo(() =>
        materials.find(m => m.id === selectedMaterialId) || materials[0] || null
        , [materials, selectedMaterialId])

    // Sync from props
    useEffect(() => {
        if (!projectPath) return
        if (lastInitializedPath.current !== projectPath) {
            if (initialMaterials && initialMaterials.length > 0) {
                const formatted = initialMaterials.map((m, index) => ({
                    id: (index + 1).toString(),
                    name: m.name,
                    E: (m.E / 1e6).toString(),
                    nu: (m.nu || 0).toString(),
                    rho: (m.rho || 0).toString(),
                    assignedGroups: m.assignedGroups || []
                }))
                setMaterials(formatted)
                if (formatted.length > 0) setSelectedMaterialId(formatted[0].id)
            } else if (materials.length === 0) {
                const def = { id: '1', name: 'Steel_S355', E: '210000', nu: '0.3', rho: '7850', assignedGroups: [] }
                setMaterials([def])
                setSelectedMaterialId('1')
            }
            lastInitializedPath.current = projectPath
        }
    }, [projectPath, initialMaterials])

    // Auto-update parent
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }
        if (onUpdate) {
            const exportData = materials.map(m => ({
                name: m.name,
                E: parseFloat(m.E) * 1e6,
                nu: parseFloat(m.nu),
                rho: parseFloat(m.rho),
                assignedGroups: m.assignedGroups
            }))
            onUpdate(exportData)
        }
    }, [materials, onUpdate])

    const addMaterial = (preset?: typeof MATERIAL_PRESETS[0]) => {
        const newId = (Date.now()).toString()
        const newMat: Material = {
            id: newId,
            name: preset?.name || `New_Material_${materials.length + 1}`,
            E: preset?.E || '210000',
            nu: preset?.nu || '0.3',
            rho: preset?.rho || '7850',
            assignedGroups: []
        }
        setMaterials([...materials, newMat])
        setSelectedMaterialId(newId)
    }

    const removeMaterial = (id: string) => {
        if (materials.length === 1) return
        const updated = materials.filter(m => m.id !== id)
        setMaterials(updated)
        if (selectedMaterialId === id) setSelectedMaterialId(updated[0].id)
    }

    const updateMaterial = (id: string, field: keyof Material, value: any) => {
        setMaterials(materials.map(m => (m.id === id ? { ...m, [field]: value } : m)))
    }

    const toggleGroup = (materialId: string, groupName: string) => {
        const material = materials.find(m => m.id === materialId)
        if (!material) return

        const currentGroups = material.assignedGroups || []
        const isAssigned = currentGroups.includes(groupName)

        // Remove from others if taken
        const otherMaterials = materials.map(m => {
            if (m.id !== materialId && m.assignedGroups.includes(groupName)) {
                return { ...m, assignedGroups: m.assignedGroups.filter(g => g !== groupName) }
            }
            return m
        })

        const updatedGroups = isAssigned
            ? currentGroups.filter(g => g !== groupName)
            : [...currentGroups, groupName]

        setMaterials(otherMaterials.map(m => (m.id === materialId ? { ...m, assignedGroups: updatedGroups } : m)))
    }

    if (!projectPath) return <div className="p-10 text-center text-slate-500 font-mono underline">SYSTEM_WAITING: SELECT_PROJECT_PATH</div>

    return (
        <div className="flex h-full w-full bg-slate-950 overflow-hidden font-sans border border-slate-800">
            {/* LEFT SIDEBAR: Material List */}
            <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-900/20">
                <div className="p-4 border-b border-slate-800 bg-slate-900/40">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-orange-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Inventory</span>
                        </div>
                        <button
                            onClick={() => addMaterial()}
                            className="p-1 bg-orange-500 hover:bg-orange-400 text-slate-950 rounded-[2px] transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Coverage Mini Widget */}
                    <div className="bg-slate-950 p-3 border border-slate-800 rounded-[2px]">
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Coverage</span>
                            <span className="text-xs font-mono text-emerald-400">{stats.percent}%</span>
                        </div>
                        <div className="h-1 w-full bg-slate-800 overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${stats.percent}%` }}
                            />
                        </div>
                        <div className="mt-2 text-[9px] text-slate-500 flex justify-between uppercase font-mono">
                            <span>{stats.assigned} Assigned</span>
                            <span>{stats.total - stats.assigned} Empty</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {materials.map(mat => {
                        const isActive = selectedMaterialId === mat.id
                        const hasGroups = mat.assignedGroups.length > 0
                        return (
                            <div
                                key={mat.id}
                                onClick={() => setSelectedMaterialId(mat.id)}
                                className={`
                                    group relative flex items-center gap-3 p-3 mb-1 cursor-pointer border transition-all
                                    ${isActive
                                        ? 'bg-orange-500/10 border-orange-500/50'
                                        : 'bg-transparent border-transparent hover:bg-slate-800/40'}
                                `}
                            >
                                <div className={`w-1 h-8 absolute left-0 ${isActive ? 'bg-orange-500' : 'bg-transparent'}`} />
                                <div className={`p-2 rounded-[2px] ${hasGroups ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                                    <Cpu className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-bold truncate ${isActive ? 'text-white' : 'text-slate-400'}`}>
                                        {mat.name}
                                    </p>
                                    <p className="text-[10px] font-mono text-slate-500 uppercase">
                                        {mat.assignedGroups.length} Groups
                                    </p>
                                </div>
                                <ChevronRight className={`w-4 h-4 ${isActive ? 'text-orange-500' : 'text-slate-700 opacity-0 group-hover:opacity-100'}`} />
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* MAIN CONTENT: Detail View */}
            <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
                {/* Background Grain/Grid Effect */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat" />

                {selectedMaterial ? (
                    <>
                        {/* Detail Header */}
                        <div className="h-20 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/10 shrink-0">
                            <div className="flex items-center gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Resource_Name</label>
                                    <input
                                        type="text"
                                        value={selectedMaterial.name}
                                        onChange={e => updateMaterial(selectedMaterial.id, 'name', e.target.value)}
                                        className="bg-transparent text-xl font-black text-white focus:outline-none border-b border-transparent focus:border-orange-500 transition-colors"
                                    />
                                </div>
                                <div className="h-8 w-[1px] bg-slate-800" />
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Status</label>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${selectedMaterial.assignedGroups.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
                                        <span className="text-xs font-mono text-slate-300">
                                            {selectedMaterial.assignedGroups.length > 0 ? 'OPERATIONAL' : 'UNASSIGNED'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="relative group/library">
                                    <button className="flex items-center gap-2 px-3 py-1.5 border border-slate-700 text-slate-400 text-[10px] font-bold uppercase hover:border-slate-500 transition-all rounded-[2px]">
                                        <Database className="w-3.5 h-3.5" />
                                        Industry Presets
                                    </button>
                                    <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-800 shadow-2xl rounded-[2px] opacity-0 invisible group-hover/library:opacity-100 group-hover/library:visible transition-all z-50">
                                        <div className="p-3 border-b border-slate-800">
                                            <span className="text-[10px] font-black text-slate-500 uppercase">Load Material Data</span>
                                        </div>
                                        {MATERIAL_PRESETS.map(p => (
                                            <button
                                                key={p.name}
                                                onClick={() => addMaterial(p)}
                                                className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-orange-500 hover:text-slate-950 transition-colors flex justify-between items-center"
                                            >
                                                {p.name}
                                                <span className="text-[9px] opacity-60 font-mono">{Math.round(parseInt(p.E) / 1000)}k MPa</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeMaterial(selectedMaterial.id)}
                                    className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-[2px] transition-all"
                                    title="Purge Material From Core"
                                    disabled={materials.length === 1}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Detail Content */}
                        <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
                            <div className="flex items-center gap-4 mb-8">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Unit System Display:</span>
                                <div className="flex bg-slate-900 border border-slate-800 p-0.5 rounded-[2px]">
                                    <button
                                        onClick={() => setUnitType('MPa')}
                                        className={`px-3 py-1 text-[10px] font-bold transition-all ${unitType === 'MPa' ? 'bg-orange-500 text-slate-950' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        MPa (Standard)
                                    </button>
                                    <button
                                        onClick={() => setUnitType('Pa')}
                                        className={`px-3 py-1 text-[10px] font-bold transition-all ${unitType === 'Pa' ? 'bg-orange-500 text-slate-950' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        Pascal (SI)
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-6 mb-12">
                                {/* Modulo de Young */}
                                <div className="group relative bg-slate-900/30 border border-slate-800 p-6 transition-all hover:border-orange-500/30">
                                    <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
                                        <Info className="w-3 h-3 text-orange-500" />
                                        Elastic Modulus (E)
                                    </label>
                                    <div className="flex items-baseline gap-2">
                                        <input
                                            type="text"
                                            value={unitType === 'MPa' ? selectedMaterial.E : (parseFloat(selectedMaterial.E) * 1e6).toExponential(2)}
                                            readOnly={unitType === 'Pa'}
                                            onChange={e => updateMaterial(selectedMaterial.id, 'E', e.target.value)}
                                            className={`w-full bg-transparent text-3xl font-black text-white font-mono focus:outline-none ${unitType === 'Pa' ? 'opacity-50' : ''}`}
                                        />
                                        <span className="text-xs font-black text-slate-600">{unitType}</span>
                                    </div>
                                    <div className="mt-4 text-[9px] text-slate-600 italic">Resistance against elastic deformation.</div>
                                </div>

                                {/* Coeficiente de Poisson */}
                                <div className="group relative bg-slate-900/30 border border-slate-800 p-6 transition-all hover:border-orange-500/30">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">Poisson Ratio (ν)</label>
                                    <div className="flex items-baseline gap-2">
                                        <input
                                            type="text"
                                            value={selectedMaterial.nu}
                                            onChange={e => updateMaterial(selectedMaterial.id, 'nu', e.target.value)}
                                            className="w-full bg-transparent text-3xl font-black text-white font-mono focus:outline-none"
                                        />
                                        <span className="text-xs font-black text-slate-600">ratio</span>
                                    </div>
                                    <div className="mt-4 text-[9px] text-slate-600 italic">Transverse/longitudinal strain ratio.</div>
                                </div>

                                {/* Densidade */}
                                <div className="group relative bg-slate-900/30 border border-slate-800 p-6 transition-all hover:border-orange-500/30">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">Material Density (ρ)</label>
                                    <div className="flex items-baseline gap-2">
                                        <input
                                            type="text"
                                            value={selectedMaterial.rho}
                                            onChange={e => updateMaterial(selectedMaterial.id, 'rho', e.target.value)}
                                            className="w-full bg-transparent text-3xl font-black text-white font-mono focus:outline-none"
                                        />
                                        <span className="text-xs font-black text-slate-600">kg/m³</span>
                                    </div>
                                    <div className="mt-4 text-[9px] text-slate-600 italic">Mass per unit volume (Required for Inertia).</div>
                                </div>
                            </div>

                        {/* Group Assignment - RADICAL UPDATE */}
                        <div className="border border-slate-800 bg-slate-900/10">
                            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/30">
                                <div className="flex items-center gap-3">
                                    <Layers className="w-5 h-5 text-orange-500" />
                                    <div>
                                        <h4 className="text-sm font-black text-white uppercase tracking-wider">Group Integration Manager</h4>
                                        <p className="text-[10px] text-slate-500 mt-0.5">Map finite element groups to this structural resource.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                                        <input
                                            type="text"
                                            placeholder="Filter Groups..."
                                            value={groupFilter}
                                            onChange={e => setGroupFilter(e.target.value)}
                                            className="bg-slate-950 border border-slate-800 rounded-[2px] pl-9 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 w-48 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-6">
                                {validGroups.length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                                        {validGroups
                                            .filter(g => g.toLowerCase().includes(groupFilter.toLowerCase()))
                                            .map(group => {
                                                const isAssigned = (selectedMaterial.assignedGroups || []).includes(group)
                                                const owner = materials.find(m => m.id !== selectedMaterial.id && m.assignedGroups.includes(group))

                                                return (
                                                    <button
                                                        key={group}
                                                        onClick={() => toggleGroup(selectedMaterial.id, group)}
                                                        className={`
                                                            relative flex flex-col group/btn px-4 py-3 border text-left transition-all active:scale-[0.98]
                                                            ${isAssigned
                                                                ? 'bg-orange-500 border-orange-400 text-slate-950 shadow-[0_0_15px_rgba(249,115,22,0.2)]'
                                                                : owner
                                                                    ? 'bg-slate-900/50 border-slate-800 text-slate-600 opacity-60 hover:opacity-100 hover:border-orange-500/50'
                                                                    : 'bg-slate-900/20 border-slate-800 text-slate-400 hover:border-slate-500 hover:bg-slate-800/40'
                                                            } rounded-[2px]
                                                        `}
                                                    >
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className={`text-[10px] font-black uppercase truncate pr-4`}>{group}</span>
                                                            {isAssigned && <Check className="w-3 h-3" />}
                                                        </div>
                                                        {owner && (
                                                            <span className="text-[8px] font-mono opacity-60">Taken by: {owner.name}</span>
                                                        )}
                                                        {!isAssigned && !owner && (
                                                            <span className="text-[8px] font-mono opacity-30 mt-auto">Available</span>
                                                        )}
                                                        {owner && !isAssigned && (
                                                            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 opacity-0 group-hover/btn:opacity-100 transition-opacity">
                                                                <span className="text-[10px] font-black text-orange-500">TRANSFER TO THIS</span>
                                                            </div>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-800 rounded-[2px]">
                                        <AlertCircle className="w-8 h-8 text-slate-700 mb-4" />
                                        <p className="text-xs font-mono text-slate-600 uppercase">No signal from mesh groups detector.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Aster Command Preview */}
                        <div className="border border-slate-800 bg-slate-900/10">
                            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/30">
                                <div className="flex items-center gap-3">
                                    <Terminal className="w-5 h-5 text-orange-500" />
                                    <div>
                                        <h4 className="text-sm font-black text-white uppercase tracking-wider">Code_Aster Command Preview</h4>
                                        <p className="text-[10px] text-slate-500 mt-0.5">Generated DEFI_MATERIAU and AFFE_MATERIAU commands</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowCommPreview(!showCommPreview)}
                                        className="p-1.5 border border-slate-700 text-slate-400 hover:border-orange-500 hover:text-orange-500 transition-all rounded-[2px]"
                                    >
                                        {showCommPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                    
                                    <button
                                        onClick={copyToClipboard}
                                        className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-700 text-slate-400 text-[10px] font-bold uppercase hover:border-orange-500 hover:text-orange-500 transition-all rounded-[2px]"
                                    >
                                        {copiedToClipboard ? (
                                            <><Check className="w-3.5 h-3.5" /> Copied!</>
                                        ) : (
                                            <><Copy className="w-3.5 h-3.5" /> Copy</>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {showCommPreview && (
                                <div className="border-t border-slate-800">
                                    {/* Commands Display */}
                                    <div className="p-4">
                                        <div className="space-y-4">
                                            {/* DEFI_MATERIAU Commands */}
                                            {materialCommands.defiCommands.length > 0 && (
                                                <div>
                                                    <h5 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">DEFI_MATERIAU Commands</h5>
                                                    <div className="bg-slate-950 border border-slate-800 rounded-[2px] p-3 overflow-x-auto">
                                                        <pre className="text-[10px] font-mono text-emerald-400 whitespace-pre-wrap">
                                                            {materialCommands.defiCommands.join('\n\n')}
                                                        </pre>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* AFFE_MATERIAU Commands */}
                                            {materialCommands.affeCommands.length > 0 && (
                                                <div>
                                                    <h5 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">AFFE_MATERIAU Command</h5>
                                                    <div className="bg-slate-950 border border-slate-800 rounded-[2px] p-3 overflow-x-auto">
                                                        <pre className="text-[10px] font-mono text-emerald-400 whitespace-pre-wrap">
                                                            {materialCommands.affeCommands.join('\n\n')}
                                                        </pre>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {materialCommands.defiCommands.length === 0 && materialCommands.affeCommands.length === 0 && (
                                                <div className="text-center py-8 text-slate-600">
                                                    <Code className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                                    <p className="text-[10px] font-mono uppercase">No commands to generate</p>
                                                    <p className="text-[9px] text-slate-700 mt-1">Add materials with assigned groups to generate commands</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-700">
                        <Cpu className="w-16 h-16 mb-6 opacity-20" />
                        <h3 className="text-xl font-black uppercase tracking-widest opacity-20">No material selected</h3>
                        <p className="text-[10px] font-mono uppercase opacity-20 mt-2">Initialize material resource in the inventory</p>
                    </div>
                )}
            </div>
        </div>
    )
}
