import { useState, useEffect, useRef } from 'react'
import {
    Plus,
    Trash2,
    Shield,
    Anchor,
    Lock,
    Activity,
    ArrowRight,
    Database,
    Settings2
} from 'lucide-react'

interface Restriction {
    id: string
    name: string
    group: string
    dx: boolean
    dy: boolean
    dz: boolean
    drx: boolean
    dry: boolean
    drz: boolean
}

interface RestrictionConfigProps {
    projectPath: string | null
    availableGroups?: string[]
    initialRestrictions?: any[]
    onUpdate?: (restrictions: any[]) => void
}

const SUPPORT_TYPES = [
    {
        id: 'FIXED',
        label: 'Fixed Support (Engaste)',
        icon: Anchor,
        dofs: { dx: true, dy: true, dz: true, drx: true, dry: true, drz: true },
        description: 'Restricts all translations and rotations.'
    },
    {
        id: 'PINNED',
        label: 'Pinned Support (Apoio)',
        icon: Target, // Custom late import or similar
        dofs: { dx: true, dy: true, dz: true, drx: false, dry: false, drz: false },
        description: 'Restricts translations. Rotations are free.'
    },
    {
        id: 'SLIDING',
        label: 'Sliding Support (Trilho)',
        icon: Activity,
        dofs: { dx: false, dy: true, dz: true, drx: false, dry: false, drz: false },
        description: 'Free to move in X, restricted in Y and Z.'
    }
]

export default function RestrictionConfig({
    projectPath,
    availableGroups = [],
    initialRestrictions = [],
    onUpdate
}: RestrictionConfigProps) {
    const [restrictions, setRestrictions] = useState<Restriction[]>([])
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
    const isFirstRender = useRef(true)
    const lastExportRef = useRef('')

    // Load initial state
    useEffect(() => {
        if (initialRestrictions.length > 0 && restrictions.length === 0) {
            const formatted = initialRestrictions.map((r, index) => ({
                id: (index + 1).toString(),
                name: r.name,
                group: r.group,
                dx: r.dof?.DX !== null,
                dy: r.dof?.DY !== null,
                dz: r.dof?.DZ !== null,
                drx: r.dof?.DRX !== null,
                dry: r.dof?.DRY !== null,
                drz: r.dof?.DRZ !== null
            }))
            setRestrictions(formatted)
            if (formatted.length > 0) setSelectedIdx(0)
        }
    }, [initialRestrictions])

    // Propagate state
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        if (onUpdate) {
            const exportData = restrictions.map(r => ({
                name: String(r.name || ''),
                group: String(r.group || ''),
                dof: {
                    DX: r.dx ? 0 : null,
                    DY: r.dy ? 0 : null,
                    DZ: r.dz ? 0 : null,
                    DRX: r.drx ? 0 : null,
                    DRY: r.dry ? 0 : null,
                    DRZ: r.drz ? 0 : null
                }
            }))

            const currentString = JSON.stringify(exportData)
            if (lastExportRef.current !== currentString) {
                lastExportRef.current = currentString
                onUpdate(exportData)
            }
        }
    }, [restrictions, onUpdate])

    const addRestriction = () => {
        const newId = (restrictions.length + 1).toString()
        const newRestriction = {
            id: newId,
            name: `BC_RULE_${newId}`,
            group: availableGroups[0] || '',
            dx: true,
            dy: true,
            dz: true,
            drx: false,
            dry: false,
            drz: false
        }
        setRestrictions([...restrictions, newRestriction])
        setSelectedIdx(restrictions.length)
    }

    const removeRestriction = (id: string) => {
        const idx = restrictions.findIndex(r => r.id === id)
        setRestrictions(restrictions.filter(r => r.id !== id))
        if (selectedIdx === idx) setSelectedIdx(null)
    }

    const updateRestriction = (id: string, field: keyof Restriction, value: any) => {
        setRestrictions(
            restrictions.map(r => (r.id === id ? { ...r, [field]: value } : r))
        )
    }

    const applyPreset = (_id: string, dofs: any) => {
        setRestrictions(prev => prev.map((r, i) => i === selectedIdx ? { ...r, ...dofs } : r))
    }

    if (!projectPath) return <div className="p-10 text-center text-slate-500 font-mono tracking-tighter uppercase italic">waiting_for_payload: select_project</div>

    const selected = selectedIdx !== null ? restrictions[selectedIdx] : null

    return (
        <div className="flex h-full w-full bg-slate-950 border border-slate-800 rounded-none overflow-hidden font-sans">
            {/* Master: Side Navigation */}
            <div className="w-[300px] shrink-0 border-r border-slate-800 flex flex-col bg-slate-900/10">
                <div className="p-4 border-b border-slate-800 bg-slate-900/30">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-purple-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">BC_Inventory</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-600 bg-slate-950 px-1.5 border border-slate-800">{restrictions.length}</span>
                    </div>
                    <button
                        onClick={addRestriction}
                        disabled={availableGroups.length === 0}
                        className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 border border-purple-500 text-slate-950 font-black text-[10px] uppercase tracking-widest hover:bg-purple-500 transition-all shadow-[0_0_15px_rgba(168,85,247,0.2)] disabled:opacity-30 disabled:grayscale"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Init Boundary Rule
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {restrictions.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-8 opacity-20 grayscale">
                            <Lock className="w-10 h-10 mb-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-center">No_Boundary_Conditions_Defined</span>
                        </div>
                    ) : (
                        restrictions.map((r, idx) => {
                            const isActive = selectedIdx === idx
                            const activeDofs = [r.dx, r.dy, r.dz, r.drx, r.dry, r.drz].filter(Boolean).length

                            return (
                                <div
                                    key={r.id}
                                    onClick={() => setSelectedIdx(idx)}
                                    className={`
                                        relative group p-4 mb-2 cursor-pointer border transition-all
                                        ${isActive ? 'bg-purple-500/5 border-purple-500/30' : 'bg-transparent border-transparent hover:bg-slate-800/40'}
                                    `}
                                >
                                    <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${isActive ? 'bg-purple-500' : 'bg-transparent'}`} />
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-xs font-black truncate ${isActive ? 'text-white' : 'text-slate-400'}`}>{r.name}</span>
                                        <span className="text-[8px] font-mono p-1 border border-slate-800 bg-slate-950 text-slate-600 uppercase italic">Active_{activeDofs}/6</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[9px] font-mono text-slate-600 uppercase">
                                        <span className="truncate max-w-[120px]">{r.group || 'UNLINKED'}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeRestriction(r.id); }}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* Detail: Inspector */}
            <div className="flex-1 flex flex-col relative bg-slate-950 overflow-hidden">
                <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat" />

                {selected ? (
                    <>
                        {/* Detail Header */}
                        <div className="h-24 shrink-0 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/10">
                            <div className="flex items-center gap-6">
                                <div className="p-4 border border-purple-500/40 bg-purple-500/5">
                                    <Lock className="w-6 h-6 text-purple-500" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Boundary_Constraint</span>
                                        <div className="w-1.5 h-1.5 rounded-none bg-purple-500 animate-pulse outline outline-1 outline-purple-500 outline-offset-2" />
                                    </div>
                                    <input
                                        type="text"
                                        value={selected.name}
                                        onChange={(e) => updateRestriction(selected.id, 'name', e.target.value)}
                                        className="bg-transparent text-2xl font-black text-white leading-none font-mono focus:outline-none focus:border-b-2 border-purple-500 w-full"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 items-center">
                                <div className="text-right">
                                    <span className="block text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Target_Mesh_Entity</span>
                                    <select
                                        value={selected.group}
                                        onChange={(e) => updateRestriction(selected.id, 'group', e.target.value)}
                                        className="bg-slate-900 border border-slate-800 text-xs font-bold text-white px-3 py-1.5 focus:outline-none focus:border-purple-500"
                                    >
                                        <option value="" disabled>Select Target Group</option>
                                        {availableGroups.map(g => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Inspector Body */}
                        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                            <div className="max-w-4xl mx-auto space-y-12">
                                {/* DOF Switchboard */}
                                <section>
                                    <div className="flex items-center gap-2 mb-8">
                                        <Settings2 className="w-4 h-4 text-purple-500" />
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Degrees_of_Freedom_Console</h4>
                                    </div>

                                    <div className="grid grid-cols-2 gap-12">
                                        {/* Translation */}
                                        <div className="space-y-4">
                                            <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest border-b border-slate-800 pb-2">Translation (X,Y,Z)</div>
                                            <div className="grid grid-cols-3 gap-3">
                                                {(['dx', 'dy', 'dz'] as const).map(dof => (
                                                    <DofToggleButton
                                                        key={dof}
                                                        label={dof}
                                                        active={selected[dof]}
                                                        onClick={() => updateRestriction(selected.id, dof, !selected[dof])}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Rotation */}
                                        <div className="space-y-4">
                                            <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest border-b border-slate-800 pb-2">Rotation (RX,RY,RZ)</div>
                                            <div className="grid grid-cols-3 gap-3">
                                                {(['drx', 'dry', 'drz'] as const).map(dof => (
                                                    <DofToggleButton
                                                        key={dof}
                                                        label={dof}
                                                        active={selected[dof]}
                                                        onClick={() => updateRestriction(selected.id, dof, !selected[dof])}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Presets Panel */}
                                <section className="pt-8 border-t border-slate-800">
                                    <div className="flex items-center gap-2 mb-8">
                                        <Activity className="w-4 h-4 text-slate-500" />
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Predefined_Support_Archetypes</h4>
                                    </div>

                                    <div className="grid grid-cols-3 gap-6">
                                        {SUPPORT_TYPES.map(preset => {
                                            const Icon = preset.icon
                                            return (
                                                <button
                                                    key={preset.id}
                                                    onClick={() => applyPreset(preset.id, preset.dofs)}
                                                    className="group flex flex-col p-6 bg-slate-900 border border-slate-800 hover:border-purple-500/50 transition-all text-left"
                                                >
                                                    <Icon className="w-6 h-6 text-slate-700 group-hover:text-purple-500 mb-4 transition-colors" />
                                                    <span className="text-[10px] font-black text-white uppercase mb-2">{preset.label}</span>
                                                    <p className="text-[9px] text-slate-600 font-mono italic leading-relaxed">{preset.description}</p>
                                                    <div className="mt-4 flex items-center gap-2 text-[8px] font-bold text-slate-500 group-hover:text-purple-400">
                                                        <span>Apply Archetype</span>
                                                        <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </section>

                                {/* Code_Aster Logic Note */}
                                <div className="p-6 bg-purple-500/5 border border-purple-500/20">
                                    <div className="flex gap-4">
                                        <Database className="w-5 h-5 text-purple-500 shrink-0" />
                                        <div>
                                            <h5 className="text-[10px] font-black text-purple-400 uppercase mb-1 tracking-widest">FEA_Solver_Propagation</h5>
                                            <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
                                                Active degrees are interpreted as rigid Dirichlet conditions (`VALE_IMPO = 0.0`) in the `AFFE_CHAR_MECA` command. Ensure your group nodes match the required topology for {selected.group}.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-20 filter grayscale">
                        <Lock className="w-16 h-16 text-slate-500 mb-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">select_restriction_policy</span>
                    </div>
                )}
            </div>
        </div>
    )
}

function DofToggleButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`
                h-16 flex flex-col items-center justify-center border transition-all
                ${active
                    ? 'bg-purple-600 border-purple-400 text-slate-950 shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                    : 'bg-slate-900 border-slate-800 text-slate-600 hover:border-slate-700'}
            `}
        >
            <span className={`text-xs font-black uppercase mb-1 ${active ? 'text-slate-950' : 'text-slate-400'}`}>{label}</span>
            <span className={`text-[8px] font-mono leading-none ${active ? 'text-purple-900' : 'text-slate-700'}`}>
                {active ? 'LOCKED' : 'FREE'}
            </span>
        </button>
    )
}

function Target({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
        </svg>
    )
}
