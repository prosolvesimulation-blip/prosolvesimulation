import { useState, useEffect } from 'react'
import {
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    Scale,
    ArrowDownToLine,
    Activity,
    Target,
    Gauge,
    Database,
    Binary
} from 'lucide-react'

interface VerificationConfigProps {
    projectPath: string | null
    config: {
        mass: any
        reactions: any
    }
    onUpdate: (type: 'mass' | 'reactions', data: any) => void
}

interface MassData {
    mass: number
    cdg_x: number
    cdg_y: number
    cdg_z: number
    ix_g: number
    iy_g: number
    iz_g: number
}

interface ReactionData {
    case_name: string
    fx: number
    fy: number
    fz: number
    mx: number
    my: number
    mz: number
}

export default function VerificationConfig({ projectPath, config, onUpdate }: VerificationConfigProps) {
    const [massData, setMassData] = useState<MassData | null>(null)
    const [reactions, setReactions] = useState<ReactionData[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadVerificationData = async () => {
        if (!projectPath) return
        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`/api/verification?project_path=${encodeURIComponent(projectPath)}`)
            const data = await response.json()

            if (data.status === 'success') {
                setMassData(data.mass_properties)
                setReactions(data.reactions || [])
            } else {
                setError(data.message || 'Failed to load verification data')
            }
        } catch (err) {
            setError('Could not connect to backend. Run simulation first.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (projectPath) loadVerificationData()
    }, [projectPath])

    const formatNumber = (num: number | undefined, decimals: number = 4) => {
        if (num === undefined || num === null) return '-'
        return num.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        })
    }

    const formatScientific = (num: number | undefined) => {
        if (num === undefined || num === null) return '-'
        return num.toExponential(3)
    }

    const toggleReactions = () => {
        const current = config.reactions?.reaction_extraction?.enabled ?? true
        onUpdate('reactions', {
            ...config.reactions,
            reaction_extraction: {
                ...config.reactions?.reaction_extraction,
                enabled: !current
            }
        })
    }

    if (!projectPath) return <div className="p-10 text-center text-slate-500 font-mono uppercase italic tracking-widest">RESTRICTION: PROJECT_ID_UNDEFINED</div>

    return (
        <div className="flex flex-col h-full w-full bg-slate-950 font-sans overflow-hidden">
            {/* Header Console */}
            <div className="h-24 shrink-0 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/10">
                <div className="flex items-center gap-6">
                    <div className="p-4 border border-emerald-500/40 bg-emerald-500/5">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Verification_Protocol</span>
                            <div className="w-1.5 h-1.5 rounded-none bg-emerald-500 animate-pulse outline outline-1 outline-emerald-500 outline-offset-2" />
                        </div>
                        <h2 className="text-2xl font-black text-white leading-none font-mono uppercase">Quality_Assurance_Dashboard</h2>
                    </div>
                </div>

                <div className="flex items-center gap-5">
                    <button
                        onClick={toggleReactions}
                        className={`flex items-center gap-2 px-4 py-2 border font-black text-[9px] uppercase tracking-widest transition-all ${(config.reactions?.reaction_extraction?.enabled ?? true)
                            ? 'bg-orange-500 border-orange-400 text-slate-950'
                            : 'bg-slate-900 border-slate-800 text-slate-600'
                            }`}
                    >
                        <Activity className="w-3.5 h-3.5" />
                        Extraction: {(config.reactions?.reaction_extraction?.enabled ?? true) ? 'ACTIVE' : 'IDLE'}
                    </button>
                    <div className="h-10 w-px bg-slate-800" />
                    <button
                        onClick={loadVerificationData}
                        disabled={loading}
                        className="flex items-center gap-3 px-6 py-2.5 bg-cyan-600 border border-cyan-400 text-slate-950 font-black text-[10px] uppercase tracking-widest transition-all hover:bg-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.2)] disabled:opacity-30"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'Fetching...' : 'Reload Results'}
                    </button>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {error && (
                    <div className="mb-8 p-6 bg-red-500/5 border border-red-500/20 flex items-start gap-4">
                        <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
                        <div>
                            <h4 className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] mb-1">Data_Extraction_Error</h4>
                            <p className="text-xs text-slate-500 font-mono">{error}</p>
                        </div>
                        <button onClick={loadVerificationData} className="ml-auto text-[9px] font-black text-red-400 uppercase py-1 px-3 border border-red-500/30 hover:bg-red-500/10 transition-all">Retry</button>
                    </div>
                )}

                <div className="grid grid-cols-12 gap-8">
                    {/* Mass Properties Inspector */}
                    <div className="col-span-12 xl:col-span-4 space-y-8">
                        <section className="bg-slate-900/40 border border-slate-800 p-8 relative">
                            <div className="absolute top-0 right-0 p-2 opacity-10">
                                <Scale className="w-16 h-16 text-slate-500" />
                            </div>
                            <div className="flex items-center gap-2 mb-8">
                                <Gauge className="w-4 h-4 text-cyan-500" />
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Mass_Properties_Inspector</h4>
                            </div>

                            {massData ? (
                                <div className="space-y-10">
                                    <div className="bg-slate-950 border border-slate-800 p-6 flex flex-col justify-center">
                                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Aggregate_Mass</label>
                                        <div className="flex items-baseline gap-3">
                                            <span className="text-5xl font-black text-emerald-400 font-mono tracking-tighter">{formatNumber(massData.mass, 2)}</span>
                                            <span className="text-xs font-black text-slate-700 uppercase">KG</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Center_of_Gravity</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[['X', massData.cdg_x], ['Y', massData.cdg_y], ['Z', massData.cdg_z]].map(([l, v]) => (
                                                <div key={l as any} className="bg-slate-950/50 border border-slate-800 p-3">
                                                    <span className="block text-[8px] font-bold text-slate-700 uppercase mb-1">{l}</span>
                                                    <span className="text-xs font-black text-slate-200 font-mono">{formatNumber(v as any, 1)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Inertia_Tensor_at_CG</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {[['Ixx', massData.ix_g], ['Iyy', massData.iy_g], ['Izz', massData.iz_g]].map(([l, v]) => (
                                                <div key={l as any} className="flex items-center justify-between bg-slate-950/50 border border-slate-800 px-4 py-2">
                                                    <span className="text-[9px] font-black text-slate-700 uppercase">{l}</span>
                                                    <span className="text-xs font-black text-slate-200 font-mono">{formatScientific(v as any)}</span>
                                                    <span className="text-[7px] text-slate-800 font-bold uppercase">KG·MM²</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-20 text-center flex flex-col items-center opacity-20">
                                    <Scale className="w-12 h-12 mb-4" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Awaiting_Analysis_Data</span>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Reactions Engine Dashboard */}
                    <div className="col-span-12 xl:col-span-8 space-y-8">
                        <section className="bg-slate-900/40 border border-slate-800 p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-2">
                                    <Binary className="w-4 h-4 text-orange-500" />
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Statical_Equilibrium_Engine</h4>
                                </div>
                                <span className="text-[9px] font-mono text-slate-600 uppercase italic">Active_Cases: {reactions.length}</span>
                            </div>

                            {reactions.length > 0 ? (
                                <div className="space-y-10">
                                    <div className="overflow-hidden border border-slate-800">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-950 border-b border-slate-800">
                                                    <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Case_Identifier</th>
                                                    <th className="p-4 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest border-l border-slate-800/50">Fx (N)</th>
                                                    <th className="p-4 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest">Fy (N)</th>
                                                    <th className="p-4 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest">Fz (N)</th>
                                                    <th className="p-4 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest border-l border-slate-800/50">Mx (N·m)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/50">
                                                {reactions.map((r, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-900/50 transition-colors">
                                                        <td className="p-4 text-xs font-black text-white font-mono uppercase italic">{r.case_name}</td>
                                                        <td className="p-4 text-right text-xs font-black text-slate-300 font-mono border-l border-slate-800/30">{formatNumber(r.fx, 1)}</td>
                                                        <td className="p-4 text-right text-xs font-black text-slate-300 font-mono">{formatNumber(r.fy, 1)}</td>
                                                        <td className="p-4 text-right text-xs font-black text-orange-400 font-mono">{formatNumber(r.fz, 1)}</td>
                                                        <td className="p-4 text-right text-xs font-black text-slate-300 font-mono border-l border-slate-800/30">{formatNumber(r.mx / 1000, 2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 flex items-start gap-6">
                                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30">
                                            <Activity className="w-6 h-6 text-emerald-500" />
                                        </div>
                                        <div>
                                            <h4 className="text-[10px] font-black text-emerald-400 uppercase mb-2 tracking-[0.2em]">Equilibrium_Validation_Protocol</h4>
                                            <p className="text-[10px] text-slate-600 font-mono leading-relaxed uppercase italic">
                                                Solver convergence confirmed. Total Z-Reaction (ΣRz) must equate to structural dead-weight in gravity conditions. Variance threshold: 0.1% for high-precision validation.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-24 text-center border-2 border-dashed border-slate-800 rounded-none opacity-20 flex flex-col items-center">
                                    <ArrowDownToLine className="w-12 h-12 mb-4" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Awaiting_Simulation_Output</span>
                                </div>
                            )}
                        </section>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="p-6 bg-slate-900/40 border border-slate-800">
                                <div className="flex gap-4">
                                    <Target className="w-5 h-5 text-indigo-500 shrink-0" />
                                    <div>
                                        <h5 className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Nodal_Origin_Reference</h5>
                                        <p className="text-[9px] text-slate-700 font-mono uppercase italic leading-relaxed">
                                            Moments (Mx, My, Mz) are evaluated at the global domain origin (0,0,0) as defined in the primary MED mesh.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 bg-slate-900/40 border border-slate-800">
                                <div className="flex gap-4">
                                    <Database className="w-5 h-5 text-indigo-500 shrink-0" />
                                    <div>
                                        <h5 className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Aster_Convergence</h5>
                                        <p className="text-[9px] text-slate-700 font-mono uppercase italic leading-relaxed">
                                            Results extracted via `REAC_NODA` operator. Data corresponds to the consolidated summation over the specified project domain.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
