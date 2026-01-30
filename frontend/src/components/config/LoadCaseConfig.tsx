import { useState, useEffect, useRef } from 'react'
import {
    Plus,
    Trash2,
    Layers,
    Database,
    ArrowRight,
    Settings2,
    ClipboardList,
    Shield
} from 'lucide-react'

interface LoadCase {
    id: string
    name: string
    loads: string[]
    restrictions: string[]
}

interface LoadCaseConfigProps {
    projectPath: string | null
    availableLoads?: any[]
    availableRestrictions?: any[]
    availableGroups?: string[]
    initialLoadCases?: any[]
    onUpdate?: (cases: any[]) => void
    onCommandsUpdate?: (cases: any[]) => void
}

export default function LoadCaseConfig({
    projectPath,
    availableLoads = [],
    availableRestrictions = [],
    availableGroups = [],
    initialLoadCases = [],
    onUpdate,
    onCommandsUpdate
}: LoadCaseConfigProps) {
    const isFirstRender = useRef(true)
    const [cases, setCases] = useState<LoadCase[]>([])
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
    const lastInitializedPath = useRef<string | null>(null)

    // Sync from props
    useEffect(() => {
        if (!projectPath) return

        if (lastInitializedPath.current !== projectPath) {
            if (initialLoadCases && initialLoadCases.length > 0) {
                const formatted = initialLoadCases.map((lc, index) => ({
                    id: (index + 1).toString(),
                    name: lc.name,
                    loads: lc.loads || [],
                    restrictions: lc.restrictions || []
                }))
                setCases(formatted)
                if (formatted.length > 0) setSelectedIdx(0)
                lastInitializedPath.current = projectPath
            } else if (cases.length === 0) {
                const initialCase = { id: '1', name: 'LOAD_COMB_01', loads: [], restrictions: [] }
                setCases([initialCase])
                setSelectedIdx(0)
                lastInitializedPath.current = projectPath
            }
        }
    }, [projectPath, initialLoadCases])

    // Propagate up
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        const formattedCases = cases.map(c => ({
            id: c.id,
            name: String(c.name || ''),
            loads: c.loads,
            restrictions: c.restrictions
        }))

        if (onUpdate && projectPath === lastInitializedPath.current) {
            onUpdate(formattedCases)
        }

        if (onCommandsUpdate && projectPath === lastInitializedPath.current) {
            onCommandsUpdate(formattedCases)
        }
    }, [cases, onUpdate, onCommandsUpdate, projectPath])

    const addCase = () => {
        const newId = (cases.length + 1).toString()
        const newCase = { id: newId, name: `LOAD_CASE_${newId.padStart(2, '0')}`, loads: [], restrictions: [] }
        setCases([...cases, newCase])
        setSelectedIdx(cases.length)
    }

    const removeCase = (id: string) => {
        const idx = cases.findIndex(c => c.id === id)
        setCases(cases.filter(c => c.id !== id))
        if (selectedIdx === idx) setSelectedIdx(null)
    }

    const updateField = (id: string, field: keyof LoadCase, value: any) => {
        setCases(cases.map(c => c.id === id ? { ...c, [field]: value } : c))
    }

    const toggleItem = (caseId: string, field: 'loads' | 'restrictions', itemName: string) => {
        setCases(cases.map(c => {
            if (c.id !== caseId) return c
            const current = c[field] || []
            const next = current.includes(itemName)
                ? current.filter(i => i !== itemName)
                : [...current, itemName]
            return { ...c, [field]: next }
        }))
    }

    if (!projectPath) return <div className="p-10 text-center text-slate-500 font-mono italic uppercase tracking-widest">HALT: UNSET_PROJECT_CONTEXT</div>

    const selected = selectedIdx !== null ? cases[selectedIdx] : null

    return (
        <div className="flex h-full w-full bg-slate-950 border border-slate-800 overflow-hidden font-sans">
            {/* Master: Case Inventory */}
            <div className="w-[300px] shrink-0 border-r border-slate-800 flex flex-col bg-slate-900/10">
                <div className="p-4 border-b border-slate-800 bg-slate-900/30">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-indigo-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Cases_Inventory</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-600 bg-slate-950 px-1.5 border border-slate-800">{cases.length}</span>
                    </div>
                    <button
                        onClick={addCase}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 border border-indigo-500 text-slate-950 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Init Combination
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {cases.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-8 opacity-20 grayscale">
                            <Database className="w-10 h-10 mb-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-center">No_Load_Cases_Defined</span>
                        </div>
                    ) : (
                        cases.map((c, idx) => {
                            const isActive = selectedIdx === idx
                            const totalItems = (c.loads?.length || 0) + (c.restrictions?.length || 0)
                            return (
                                <div
                                    key={c.id}
                                    onClick={() => setSelectedIdx(idx)}
                                    className={`
                                        relative group p-4 mb-2 cursor-pointer border transition-all
                                        ${isActive ? 'bg-indigo-500/5 border-indigo-500/30' : 'bg-transparent border-transparent hover:bg-slate-800/40'}
                                    `}
                                >
                                    <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${isActive ? 'bg-indigo-500' : 'bg-transparent'}`} />
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-xs font-black truncate ${isActive ? 'text-white' : 'text-slate-400'}`}>{c.name}</span>
                                        <span className="text-[8px] font-mono p-1 border border-slate-800 bg-slate-950 text-slate-600 uppercase italic">Comb_{totalItems}</span>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeCase(c.id); }}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all ml-auto block"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 text-slate-600" />
                                    </button>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* Detail: Combination Matrix */}
            <div className="flex-1 flex flex-col relative bg-slate-950 overflow-hidden">
                <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat" />

                {selected ? (
                    <>
                        {/* Detail Header */}
                        <div className="h-24 shrink-0 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/10">
                            <div className="flex items-center gap-6">
                                <div className="p-4 border border-indigo-500/40 bg-indigo-500/5">
                                    <Layers className="w-6 h-6 text-indigo-500" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Combination_Protocol</span>
                                        <div className="w-1.5 h-1.5 rounded-none bg-indigo-500 animate-pulse outline outline-1 outline-indigo-500 outline-offset-2" />
                                    </div>
                                    <input
                                        type="text"
                                        value={selected.name}
                                        onChange={(e) => updateField(selected.id, 'name', e.target.value)}
                                        className="bg-transparent text-2xl font-black text-white leading-none font-mono focus:outline-none focus:border-b-2 border-indigo-500 w-full uppercase"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Inspector Body */}
                        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                            <div className="max-w-5xl mx-auto space-y-12">
                                {/* Load Matrix */}
                                <section>
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-2">
                                            <Settings2 className="w-4 h-4 text-cyan-500" />
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loads_Matrix_Configuration</h4>
                                        </div>
                                        <span className="text-[9px] font-mono text-slate-600 uppercase italic">Selected: {selected.loads.length}</span>
                                    </div>

                                    <div className="grid grid-cols-4 gap-3">
                                        {availableLoads.length === 0 ? (
                                            <div className="col-span-4 p-8 border border-slate-800 border-dashed text-center">
                                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Neutral_State: No_Loads_Detected</span>
                                            </div>
                                        ) : (
                                            availableLoads.map(load => (
                                                <MatrixItem
                                                    key={load.name}
                                                    label={load.name}
                                                    active={selected.loads.includes(load.name)}
                                                    onClick={() => toggleItem(selected.id, 'loads', load.name)}
                                                    theme="CYAN"
                                                />
                                            ))
                                        )}
                                    </div>
                                </section>

                                {/* Restriction Matrix */}
                                <section className="pt-8 border-t border-slate-800">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-2">
                                            <Shield className="w-4 h-4 text-purple-500" />
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Boundary_Condition_Coupling</h4>
                                        </div>
                                        <span className="text-[9px] font-mono text-slate-600 uppercase italic">Selected: {selected.restrictions.length}</span>
                                    </div>

                                    <div className="grid grid-cols-4 gap-3">
                                        {(availableRestrictions.length > 0 ? availableRestrictions : availableGroups).length === 0 ? (
                                            <div className="col-span-4 p-8 border border-slate-800 border-dashed text-center">
                                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Neutral_State: No_Conditions_Detected</span>
                                            </div>
                                        ) : (
                                            (availableRestrictions.length > 0 ? availableRestrictions : availableGroups).map(item => {
                                                const name = typeof item === 'string' ? item : item.name
                                                return (
                                                    <MatrixItem
                                                        key={name}
                                                        label={name}
                                                        active={selected.restrictions.includes(name)}
                                                        onClick={() => toggleItem(selected.id, 'restrictions', name)}
                                                        theme="PURPLE"
                                                    />
                                                )
                                            })
                                        )}
                                    </div>
                                </section>

                                {/* System Logic */}
                                <div className="p-6 bg-indigo-500/5 border border-indigo-500/20">
                                    <div className="flex gap-4">
                                        <ArrowRight className="w-5 h-5 text-indigo-500 shrink-0" />
                                        <div>
                                            <h5 className="text-[10px] font-black text-indigo-400 uppercase mb-2 tracking-widest">Aster_Case_Synthesis</h5>
                                            <p className="text-[9px] text-slate-500 font-mono leading-relaxed uppercase">
                                                Each load case generates an independent `MECA_STATIQUE` resolution in the solver. Resulting displacements and stresses are extracted per combination protocol.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-20 filter grayscale">
                        <Layers className="w-16 h-16 text-slate-500 mb-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">awaiting_combination_selection</span>
                    </div>
                )}
            </div>
        </div>
    )
}

function MatrixItem({ label, active, onClick, theme }: { label: string, active: boolean, onClick: () => void, theme: 'CYAN' | 'PURPLE' }) {
    const activeClass = theme === 'CYAN' ? 'bg-cyan-600 border-cyan-400 text-slate-950' : 'bg-purple-600 border-purple-400 text-slate-950'
    const inactiveClass = 'bg-slate-900 border-slate-800 text-slate-600 hover:border-slate-700'
    const indicatorClass = theme === 'CYAN' ? 'bg-cyan-400' : 'bg-purple-400'

    return (
        <button
            onClick={onClick}
            className={`
                relative h-12 flex items-center justify-center border p-2 transition-all overflow-hidden
                ${active ? activeClass + ' shadow-[0_0_15px_rgba(34,211,238,0.2)]' : inactiveClass}
            `}
        >
            <span className="text-[10px] font-black uppercase truncate">{label}</span>
            {active && (
                <div className={`absolute top-0 right-0 w-2 h-2 ${indicatorClass} translate-x-1 -translate-y-1 rotate-45`} />
            )}
        </button>
    )
}
