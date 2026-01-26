import { useState, useEffect, useRef } from 'react'
import {
    Trash2,
    Zap,
    Globe,
    Waves,
    Settings2,
    Database,
    TrendingUp,
    Info,
    Boxes
} from 'lucide-react'

interface Load {
    id: string
    name: string
    type: 'gravity' | 'force' | 'pressure'
    group?: string
    fx?: string
    fy?: string
    fz?: string
    pressure?: string
    ax?: string
    ay?: string
    az?: string
    intensity?: string
}

interface LoadConfigProps {
    projectPath: string | null
    availableGroups?: string[]
    initialLoads?: any[]
    onUpdate?: (loads: any[]) => void
}

const LOAD_VARIANTS = {
    'gravity': { label: 'Grav_Acceleration', icon: Globe, color: 'text-orange-500', btn: 'bg-orange-600', unit: 'm/s²' },
    'force': { label: 'Nodal_Force', icon: Zap, color: 'text-emerald-500', btn: 'bg-emerald-600', unit: 'N' },
    'pressure': { label: 'Surface_Pressure', icon: Waves, color: 'text-cyan-500', btn: 'bg-cyan-600', unit: 'Pa' }
}

export default function LoadConfig({
    projectPath,
    availableGroups = [],
    initialLoads = [],
    onUpdate
}: LoadConfigProps) {
    const [loads, setLoads] = useState<Load[]>([])
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
    const isFirstRender = useRef(true)
    const lastExportRef = useRef('')

    // Persistence: Load from Props
    useEffect(() => {
        if (initialLoads.length > 0 && loads.length === 0) {
            const formatted = initialLoads.map((l, index) => {
                let type: 'gravity' | 'force' | 'pressure' = 'force'
                if (l.type === 'PESANTEUR') type = 'gravity'
                else if (l.type === 'PRESSION') type = 'pressure'

                return {
                    id: (index + 1).toString(),
                    name: l.name,
                    type: type,
                    group: l.group || '',
                    fx: l.fx?.toString() || '0',
                    fy: l.fy?.toString() || '0',
                    fz: l.fz?.toString() || '0',
                    pressure: l.pressure?.toString() || '0',
                    ax: l.direction?.[0]?.toString() || '0',
                    ay: l.direction?.[1]?.toString() || '0',
                    az: l.direction?.[2]?.toString() || '-1',
                    intensity: l.gravite?.toString() || '9.81'
                }
            })
            setLoads(formatted)
            if (formatted.length > 0) setSelectedIdx(0)
        }
    }, [initialLoads])

    // Sync to Parent
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        if (onUpdate) {
            const exportData = loads.map(l => {
                if (l.type === 'gravity') {
                    return {
                        name: String(l.name || ''),
                        type: 'PESANTEUR',
                        direction: [parseFloat(l.ax || '0'), parseFloat(l.ay || '0'), parseFloat(l.az || '-1')],
                        gravite: parseFloat(l.intensity || '9.81')
                    }
                } else if (l.type === 'force') {
                    return {
                        name: String(l.name || ''),
                        type: 'FORCE_NODALE',
                        group: String(l.group || ''),
                        fx: parseFloat(l.fx || '0'),
                        fy: parseFloat(l.fy || '0'),
                        fz: parseFloat(l.fz || '0')
                    }
                } else {
                    return {
                        name: String(l.name || ''),
                        type: 'PRESSION',
                        group: String(l.group || ''),
                        pressure: parseFloat(l.pressure || '0')
                    }
                }
            })

            const currentString = JSON.stringify(exportData)
            if (lastExportRef.current !== currentString) {
                lastExportRef.current = currentString
                onUpdate(exportData)
            }
        }
    }, [loads, onUpdate])

    const addItem = (type: 'gravity' | 'force' | 'pressure') => {
        const newId = (loads.length + 1).toString()
        const suffix = type === 'gravity' ? 'ACCEL' : type === 'force' ? 'LOAD' : 'PRESS'
        const newItem: Load = {
            id: newId,
            name: `${suffix}_${newId}`,
            type,
            group: availableGroups[0] || '',
            fx: '0', fy: '0', fz: '0', pressure: '0', ax: '0', ay: '0', az: '-1', intensity: '9.81'
        }
        setLoads([...loads, newItem])
        setSelectedIdx(loads.length)
    }

    const removeItem = (id: string) => {
        const idx = loads.findIndex(l => l.id === id)
        setLoads(loads.filter(l => l.id !== id))
        if (selectedIdx === idx) setSelectedIdx(null)
    }

    const updateItem = (id: string, field: keyof Load, value: any) => {
        setLoads(loads.map(l => (l.id === id ? { ...l, [field]: value } : l)))
    }

    if (!projectPath) return <div className="p-10 text-center text-slate-500 font-mono italic uppercase tracking-widest">HALT: SESSION_ID_UNSET</div>

    const selected = selectedIdx !== null ? loads[selectedIdx] : null

    return (
        <div className="flex h-full w-full bg-slate-950 border border-slate-800 overflow-hidden font-sans">
            {/* Master: Load Inventory */}
            <div className="w-[300px] shrink-0 border-r border-slate-800 flex flex-col bg-slate-900/10">
                <div className="p-4 border-b border-slate-800 bg-slate-900/30">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Load_Register</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-600 bg-slate-950 px-1.5 border border-slate-800">{loads.length}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                        {Object.entries(LOAD_VARIANTS).map(([k, v]) => (
                            <button
                                key={k}
                                onClick={() => addItem(k as any)}
                                className={`flex flex-col items-center justify-center p-2 border border-slate-800 bg-slate-950 hover:bg-slate-900 transition-all group`}
                                title={`Add ${v.label}`}
                            >
                                <v.icon className={`w-3.5 h-3.5 ${v.color} mb-1 opacity-60 group-hover:opacity-100`} />
                                <span className="text-[7px] font-black text-slate-600 uppercase truncate w-full text-center group-hover:text-slate-400">{v.label.split('_')[0]}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {loads.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-8 opacity-20 grayscale">
                            <Zap className="w-10 h-10 mb-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-center">No_Loads_Simulated</span>
                        </div>
                    ) : (
                        loads.map((l, idx) => {
                            const isActive = selectedIdx === idx
                            const Variant = LOAD_VARIANTS[l.type]
                            return (
                                <div
                                    key={l.id}
                                    onClick={() => setSelectedIdx(idx)}
                                    className={`
                                        relative group p-4 mb-2 cursor-pointer border transition-all
                                        ${isActive ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-transparent border-transparent hover:bg-slate-800/40'}
                                    `}
                                >
                                    <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${isActive ? 'bg-emerald-500' : 'bg-transparent'}`} />
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-xs font-black truncate ${isActive ? 'text-white' : 'text-slate-400'}`}>{l.name}</span>
                                        <Variant.icon className={`w-3 h-3 ${Variant.color} opacity-40`} />
                                    </div>
                                    <div className="flex justify-between items-center text-[9px] font-mono text-slate-600 uppercase">
                                        <span className="truncate max-w-[150px]">{l.group || 'GLOBAL'}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeItem(l.id); }}
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
                                <div className={`p-4 border ${LOAD_VARIANTS[selected.type].color.replace('text', 'border')}/40 bg-slate-900`}>
                                    {(() => {
                                        const Icon = LOAD_VARIANTS[selected.type].icon
                                        return <Icon className={`w-6 h-6 ${LOAD_VARIANTS[selected.type].color}`} />
                                    })()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">External_Stimulus</span>
                                        <div className={`w-1.5 h-1.5 rounded-none animate-pulse outline outline-1 outline-offset-2 ${LOAD_VARIANTS[selected.type].btn.replace('bg-', 'bg-').replace('600', '500')} ${LOAD_VARIANTS[selected.type].btn.replace('bg-', 'outline-')}`} />
                                    </div>
                                    <input
                                        type="text"
                                        value={selected.name}
                                        onChange={(e) => updateItem(selected.id, 'name', e.target.value)}
                                        className="bg-transparent text-2xl font-black text-white leading-none font-mono focus:outline-none focus:border-b-2 border-emerald-500 w-full"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 items-center">
                                {selected.type !== 'gravity' && (
                                    <div className="text-right">
                                        <span className="block text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Target_Boundary_Group</span>
                                        <select
                                            value={selected.group}
                                            onChange={(e) => updateItem(selected.id, 'group', e.target.value)}
                                            className="bg-slate-900 border border-slate-800 text-xs font-bold text-white px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                                        >
                                            <option value="" disabled>Select Target</option>
                                            {availableGroups.map(g => (
                                                <option key={g} value={g}>{g}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Inspector Body */}
                        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                            <div className="max-w-4xl mx-auto space-y-12">
                                {/* Parameters Console */}
                                <section>
                                    <div className="flex items-center gap-2 mb-8">
                                        <Settings2 className="w-4 h-4 text-emerald-500" />
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Signal_Intensity_Console</h4>
                                    </div>

                                    {selected.type === 'gravity' && (
                                        <div className="space-y-10">
                                            <div className="grid grid-cols-1 gap-6">
                                                <VectorInput
                                                    label="Acceleration_Intensity"
                                                    value={selected.intensity}
                                                    unit="m/s²"
                                                    onChange={(v) => updateItem(selected.id, 'intensity', v)}
                                                    theme="ORANGE"
                                                    fullWidth
                                                />
                                            </div>
                                            <div className="grid grid-cols-3 gap-6">
                                                {(['ax', 'ay', 'az'] as const).map(dir => (
                                                    <VectorInput
                                                        key={dir}
                                                        label={`Dir_${dir.slice(1).toUpperCase()}`}
                                                        value={selected[dir]}
                                                        unit="vec"
                                                        onChange={(v) => updateItem(selected.id, dir, v)}
                                                        theme="ORANGE"
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selected.type === 'force' && (
                                        <div className="grid grid-cols-3 gap-6">
                                            {(['fx', 'fy', 'fz'] as const).map(dir => (
                                                <VectorInput
                                                    key={dir}
                                                    label={`Force_${dir.slice(-1).toUpperCase()}`}
                                                    value={selected[dir]}
                                                    unit="N"
                                                    onChange={(v) => updateItem(selected.id, dir, v)}
                                                    theme="EMERALD"
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {selected.type === 'pressure' && (
                                        <div className="max-w-md">
                                            <VectorInput
                                                label="Surface_Pressure"
                                                value={selected.pressure}
                                                unit="Pa"
                                                onChange={(v) => updateItem(selected.id, 'pressure', v)}
                                                theme="CYAN"
                                                fullWidth
                                            />
                                        </div>
                                    )}
                                </section>

                                {/* Solver Context */}
                                <div className="grid grid-cols-2 gap-6 pt-8 border-t border-slate-800">
                                    <div className="p-6 bg-slate-900 border border-slate-800">
                                        <div className="flex gap-4">
                                            <Boxes className="w-5 h-5 text-slate-700 shrink-0" />
                                            <div>
                                                <h5 className="text-[10px] font-black text-white uppercase mb-2 tracking-widest">Mesh_Entity_Link</h5>
                                                <p className="text-[9px] text-slate-600 font-mono leading-relaxed uppercase">
                                                    {selected.group || 'GLOBAL_DOMAIN'} is currently selected as the active receiver for this Load command.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-6 bg-emerald-500/5 border border-emerald-500/10">
                                        <div className="flex gap-4">
                                            <Database className="w-5 h-5 text-emerald-500 shrink-0" />
                                            <div>
                                                <h5 className="text-[10px] font-black text-emerald-400 uppercase mb-2 tracking-widest">Aster_Operator</h5>
                                                <p className="text-[9px] text-slate-500 font-mono leading-relaxed">
                                                    Interpreted by `AFFE_CHAR_MECA`. Force uses `FORCE_NODALE` or `FORCE_FACE`. Pressure uses `PRES_REP`.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 p-4 bg-slate-900/50 border border-slate-800/50">
                                    <Info className="w-3.5 h-3.5 text-slate-600" />
                                    <span className="text-[9px] font-mono text-slate-600 uppercase italic">
                                        Note: Simulation results depend on consistent load signs relative to the global axis system.
                                    </span>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-20 filter grayscale">
                        <Zap className="w-16 h-16 text-slate-500 mb-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">select_thermal_force_policy</span>
                    </div>
                )}
            </div>
        </div>
    )
}

function VectorInput({ label, value, unit, onChange, theme, fullWidth }: { label: string, value: any, unit: string, onChange: (v: string) => void, theme?: 'EMERALD' | 'ORANGE' | 'CYAN', fullWidth?: boolean }) {
    const colorClass = theme === 'ORANGE' ? 'text-orange-500' : theme === 'CYAN' ? 'text-cyan-400' : 'text-emerald-400'
    const borderClass = theme === 'ORANGE' ? 'border-orange-500/30' : theme === 'CYAN' ? 'border-cyan-500/30' : 'border-emerald-500/30'

    return (
        <div className={`group relative bg-slate-950/50 border border-slate-800 p-6 transition-all hover:bg-slate-900 ${fullWidth ? 'w-full' : ''}`}>
            <label className="block text-[9px] font-black text-slate-600 uppercase mb-3 tracking-tighter">
                {label}
            </label>
            <div className="flex items-baseline gap-4">
                <input
                    type="text"
                    value={value || '0'}
                    onChange={(e) => onChange(e.target.value)}
                    className={`w-full bg-transparent text-3xl font-black ${colorClass} font-mono focus:outline-none`}
                />
                <span className="text-[10px] font-black text-slate-700 tracking-widest">{unit}</span>
            </div>
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${borderClass} bg-current opacity-0 group-hover:opacity-100 transition-opacity`} />
        </div>
    )
}
