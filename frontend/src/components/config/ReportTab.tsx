import React, { useState } from 'react'
import {
    FileText,
    Download,
    CheckCircle,
    AlertCircle,
    Loader2,
    Eye,
    Check
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ReportTabProps {
    projectPath: string | null;
}

const SECTIONS = [
    { id: 'model', label: 'Model Properties (Mass/CG)' },
    { id: 'materials', label: 'Materials Configuration' },
    { id: 'geometries', label: 'Geometry & Sections' },
    { id: 'restrictions', label: 'Boundary Conditions' },
    { id: 'loads', label: 'Applied Loads' },
    { id: 'load_cases', label: 'Load Cases Summary' },
    { id: 'results', label: 'Structural Results (Stress/Reactions)' },
]

const ReportTab: React.FC<ReportTabProps> = ({ projectPath }) => {
    const [isGenerating, setIsGenerating] = useState(false)
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [statusMsg, setStatusMsg] = useState("")
    const [lastFilePath, setLastFilePath] = useState<string | null>(null)
    const [selection, setSelection] = useState<Record<string, boolean>>(
        SECTIONS.reduce((acc, s) => ({ ...acc, [s.id]: true }), {})
    )

    const toggleSection = (id: string) => {
        setSelection(prev => ({ ...prev, [id]: !prev[id] }))
    }

    const generateReport = async () => {
        if (!projectPath) return
        setIsGenerating(true)
        setStatus('idle')
        setLastFilePath(null)

        try {
            const res = await fetch('/api/report/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_path: projectPath,
                    selection: selection,
                    images: [] // Placeholder for screenshots
                })
            })
            const data = await res.json()

            if (data.status === 'success') {
                setStatus('success')
                setStatusMsg(`Report saved successfully.`)
                setLastFilePath(data.file_path)
            } else {
                setStatus('error')
                setStatusMsg(data.message || "Generation failed")
            }
        } catch (err) {
            setStatus('error')
            setStatusMsg("Network or Server Error")
        } finally {
            setIsGenerating(false)
        }
    }

    const openReport = async () => {
        if (!lastFilePath) return
        try {
            await fetch('/api/report/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_path: lastFilePath })
            })
        } catch (err) {
            console.error("Failed to open report", err)
        }
    }

    if (!projectPath) return <div className="p-20 text-slate-500 font-mono text-center">NO PROJECT ACTIVE</div>

    return (
        <div className="h-full bg-slate-1000 overflow-y-auto p-4 md:p-8 flex flex-col items-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="p-8 bg-slate-900/50 border-b border-slate-800 flex items-center gap-6">
                    <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                        <FileText size={40} className="text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tight leading-tight">Technical Report</h2>
                        <p className="text-slate-400 text-sm mt-1">Configure and generate professional engineering documentation.</p>
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    {/* Selection Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Include Sections</h3>
                            <button
                                onClick={() => setSelection(SECTIONS.reduce((acc, s) => ({ ...acc, [s.id]: !Object.values(selection).every(v => v) }), {}))}
                                className="text-[10px] uppercase font-bold text-blue-400 hover:text-blue-300 transition"
                            >
                                {Object.values(selection).every(v => v) ? 'Unselect All' : 'Select All'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {SECTIONS.map(section => (
                                <button
                                    key={section.id}
                                    onClick={() => toggleSection(section.id)}
                                    className={`
                                        flex items-center justify-between p-3 rounded-xl border transition-all duration-200
                                        ${selection[section.id]
                                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-100 shadow-inner shadow-blue-500/5'
                                            : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'
                                        }
                                    `}
                                >
                                    <span className="text-sm font-semibold">{section.label}</span>
                                    <div className={`
                                        w-5 h-5 rounded-md flex items-center justify-center transition-colors
                                        ${selection[section.id] ? 'bg-blue-500' : 'bg-slate-800'}
                                    `}>
                                        {selection[section.id] && <Check size={14} className="text-white" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Action Area */}
                    <div className="space-y-4 pt-4">
                        <div className="flex gap-4">
                            <button
                                onClick={generateReport}
                                disabled={isGenerating}
                                className={`
                                    flex-1 py-4 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all
                                    ${isGenerating
                                        ? 'bg-slate-800 text-slate-600 cursor-wait'
                                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-900/20 active:scale-95'
                                    }
                                `}
                            >
                                {isGenerating ? (
                                    <><Loader2 className="animate-spin" /> Compiling Report...</>
                                ) : (
                                    <><Download size={20} /> Generate DOCX</>
                                )}
                            </button>

                            <AnimatePresence>
                                {status === 'success' && lastFilePath && (
                                    <motion.button
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        onClick={openReport}
                                        className="px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-3 font-bold uppercase text-xs tracking-tighter transition-all active:scale-95"
                                    >
                                        <Eye size={20} /> Open
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Status Feedback */}
                        {status !== 'idle' && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`
                                    p-4 rounded-xl text-sm font-bold flex items-center gap-3 border
                                    ${status === 'success'
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                    }
                                `}
                            >
                                {status === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                                {statusMsg}
                            </motion.div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Pro Tip */}
            <div className="mt-8 text-center text-slate-500 text-[10px] uppercase font-bold tracking-[3px] opacity-40">
                PROSOLVE ENTERPRISE • ISO COMPLIANT EXPORT
            </div>
        </div>
    )
}

export default ReportTab
