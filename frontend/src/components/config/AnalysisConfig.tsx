import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Settings, BarChart3, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface AnalysisConfigProps {
    projectPath: string | null;
    initialAnalysis?: any;
    onUpdate: (data: any) => void;
}

const ANALYSIS_TYPES = [
    { id: 'STATIQUE', label: 'Static Linear', description: 'Small displacements, linear materials.' },
    { id: 'STATIQUE_NON_LINEAIRE', label: 'Static Non-Linear', description: 'Large displacements, contact, or non-linear materials.' },
    { id: 'FLAMBEMENT', label: 'Buckling', description: 'Stability analysis and critical load factors.' },
    { id: 'MODAL', label: 'Modal Analysis', description: 'Natural frequencies and mode shapes.' },
    { id: 'DYNAMIQUE', label: 'Dynamic Analysis', description: 'Time-dependent loading and inertia effects.' }
]

const AnalysisConfig: React.FC<AnalysisConfigProps> = ({ projectPath, initialAnalysis, onUpdate }) => {
    const [config, setConfig] = useState(initialAnalysis || {
        type: 'STATIQUE',
        parameters: {
            time_stepping: 'AUTO',
            max_iter: 20,
            precision: 1e-6
        }
    })

    const handleSelectType = (id: string) => {
        const newConfig = { ...config, type: id }
        setConfig(newConfig)
        onUpdate(newConfig)
    }

    if (!projectPath) return <div className="p-20 text-slate-500 font-mono text-center">NO PROJECT ACTIVE</div>

    return (
        <div className="h-full bg-slate-1000 overflow-y-auto p-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto space-y-8"
            >
                <div className="flex items-center gap-4 border-b border-slate-800 pb-6">
                    <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                        <Settings size={24} className="text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Analysis & Settings</h2>
                        <p className="text-slate-400 text-xs font-medium uppercase tracking-widest opacity-60">Solver & Execution Parameters</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ANALYSIS_TYPES.map((type) => (
                        <button
                            key={type.id}
                            onClick={() => handleSelectType(type.id)}
                            className={`
                                flex items-start gap-4 p-5 rounded-2xl border transition-all text-left
                                ${config.type === type.id
                                    ? 'bg-indigo-500/10 border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.1)]'
                                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                                }
                            `}
                        >
                            <div className={`
                                p-2 rounded-lg
                                ${config.type === type.id ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'}
                            `}>
                                <BarChart3 size={18} />
                            </div>
                            <div className="flex-1">
                                <span className={`text-sm font-black uppercase tracking-wide ${config.type === type.id ? 'text-indigo-300' : 'text-slate-200'}`}>
                                    {type.label}
                                </span>
                                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                                    {type.description}
                                </p>
                            </div>
                            {config.type === type.id && (
                                <CheckCircle2 size={16} className="text-indigo-400" />
                            )}
                        </button>
                    ))}
                </div>

                {/* --- EXECUTION SETTINGS --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                        <div className="flex items-center gap-2 text-slate-300">
                            <Clock size={16} className="text-slate-500" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest">Computational Strategy</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Parallelization (NCPUS)</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="1"
                                        max="32"
                                        value={config.parameters.ncpus || 1}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value)
                                            const newConfig = { ...config, parameters: { ...config.parameters, ncpus: val } }
                                            setConfig(newConfig)
                                            onUpdate(newConfig)
                                        }}
                                        className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                    <span className="text-xs font-mono text-white bg-slate-950 px-2 py-1 rounded border border-white/5">{config.parameters.ncpus || 1}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Linear Solver Method</label>
                                <select
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-indigo-500 outline-none transition-colors appearance-none"
                                >
                                    <option value="MULTIFRONT">Multifrontal (Direct)</option>
                                    <option value="LDLT">LDLT (Direct Matrix)</option>
                                    <option value="GMRES">GMRES (Iterative)</option>
                                    <option value="PETSC">PETSc Parallel</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                        <div className="flex items-center gap-2 text-slate-300">
                            <BarChart3 size={16} className="text-slate-500" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest">Convergence & Output</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase">Max Iterations</label>
                                <input
                                    type="number"
                                    value={config.parameters.max_iter}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value)
                                        const newConfig = { ...config, parameters: { ...config.parameters, max_iter: val } }
                                        setConfig(newConfig)
                                        onUpdate(newConfig)
                                    }}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase">Precision</label>
                                <input
                                    type="text"
                                    value={config.parameters.precision}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value)
                                        const newConfig = { ...config, parameters: { ...config.parameters, precision: val } }
                                        setConfig(newConfig)
                                        onUpdate(newConfig)
                                    }}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="pt-2 border-t border-white/5">
                            <label className="text-[9px] font-black text-slate-500 uppercase mb-2 block">Output Frequency</label>
                            <div className="flex gap-2">
                                {['Every Step', 'Final Only', 'Periodic'].map(opt => (
                                    <button key={opt} className={`flex-1 py-1 px-2 border rounded-md text-[8px] font-black uppercase transition-all ${opt === 'Final Only' ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-white/5 text-slate-600 hover:text-slate-400'}`}>
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 flex items-start gap-4">
                    <AlertTriangle size={18} className="text-indigo-400 mt-1 shrink-0" />
                    <div>
                        <p className="text-[11px] font-bold text-indigo-300 uppercase mb-1">Solver Integrity Warning</p>
                        <p className="text-[10px] text-slate-400 leading-relaxed italic">
                            Aumentar NCPUS reduz o tempo de processamento, mas requer licença do solver paralelizável e memória RAM compatível. Precision values between 1e-6 and 1e-8 are recommended for most industrial applications.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}

export default AnalysisConfig
