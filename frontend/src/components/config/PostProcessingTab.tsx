import React, { useState, useEffect } from 'react'
import {
    Monitor,
    Zap,
    Activity,
    Settings,
    Download,
    Maximize2,
    Binary,
    BarChart3,
    TrendingUp
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import VtkResultViewer from './VtkResultViewer'

interface PostProcessingTabProps {
    projectPath: string | null;
}

const PostProcessingTab: React.FC<PostProcessingTabProps> = ({ projectPath }) => {
    const [isLoading, setIsLoading] = useState(false)
    const [resultMeta, setResultMeta] = useState<any>(null)
    const [selectedStep, setSelectedStep] = useState(0)
    const [selectedField, setSelectedField] = useState<'mises' | 'depl'>('mises')
    const [warpScale, setWarpScale] = useState(1.0)

    // Data States
    const [meshData, setMeshData] = useState<any>(null)
    const [physicsData, setPhysicsData] = useState<any>(null)

    // 1. Initial Meta Load
    useEffect(() => {
        if (!projectPath) return
        loadResultMeta()
    }, [projectPath])

    const loadResultMeta = async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/post/results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_path: projectPath })
            })
            const data = await res.json()
            if (data.status === 'success') {
                setResultMeta(data.fields)
            }
        } catch (err) {
            console.error("Failed to load meta:", err)
        } finally {
            setIsLoading(false)
        }
    }

    // 2. Data Loader Orchestrator
    useEffect(() => {
        if (!projectPath || !resultMeta) return
        refreshFieldData()
    }, [selectedStep, selectedField, projectPath, resultMeta])

    const refreshFieldData = async () => {
        if (!projectPath || !resultMeta) return

        setIsLoading(true)
        console.log("[Analysis] Requesting Unified Scene for:", { selectedField, selectedStep });

        try {
            // Resolve Actual Field Name
            const availableFields = Object.keys(resultMeta);
            let targetField = "";
            if (selectedField === 'mises') {
                targetField = availableFields.find(f => f.includes("VM_MID")) ||
                    availableFields.find(f => f.startsWith("VM_")) || "";
            } else {
                targetField = availableFields.find(f => f.includes("DEPL")) || "";
            }

            if (!targetField) {
                console.warn("[Analysis] Target field not resolved");
                setIsLoading(false);
                return;
            }

            // ONE CALL TO RULE THEM ALL: Get Mesh + Physics Context
            const res = await fetch('/api/post/field', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_path: projectPath,
                    mode: targetField,
                    step: selectedStep
                })
            });
            const scene = await res.json();

            if (scene.status === 'success') {
                console.log("[Analysis] Unified Scene Received. Loc:", scene.physics?.location);
                setMeshData(scene.mesh);
                setPhysicsData(scene.physics);
            } else {
                console.error("[Analysis] Pipeline Error:", scene.message);
            }
        } catch (err) {
            console.error("[Analysis] Refresh Exception:", err);
        } finally {
            setIsLoading(false);
        }
    }

    if (!projectPath) return <div className="p-20 text-slate-700 italic font-mono uppercase tracking-widest text-center">Null_Path_Abort: No project active</div>

    return (
        <div className="h-full flex overflow-hidden bg-slate-950 font-sans border border-white/5 relative">
            <div className="w-80 shrink-0 border-r border-white/5 flex flex-col bg-slate-900/20 backdrop-blur-md">
                <div className="p-6 border-b border-white/5">
                    <div className="flex items-center gap-3 mb-1">
                        <Activity className="text-orange-500" size={18} />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Post_Analysis</span>
                    </div>
                    <h2 className="text-xl font-black text-white leading-none">Simulation Results</h2>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
                    <section>
                        <Label text="Data_Domain" icon={<Binary size={12} />} />
                        <div className="grid grid-cols-1 gap-2 mt-3">
                            <FieldOption
                                active={selectedField === 'mises'}
                                onClick={() => setSelectedField('mises')}
                                label="Von Mises Stress"
                                desc="Equivalent elastic stress (MPa)"
                                icon={<Zap size={14} className="text-yellow-500" />}
                            />
                            <FieldOption
                                active={selectedField === 'depl'}
                                onClick={() => setSelectedField('depl')}
                                label="Total Displacement"
                                desc="Cartesian deformation (mm)"
                                icon={<TrendingUp size={14} className="text-cyan-400" />}
                            />
                        </div>
                    </section>

                    <section>
                        <Label text="Temporal_Step" icon={<Settings size={12} />} />
                        <div className="mt-4 p-4 bg-white/5 border border-white/5 rounded-lg">
                            <select
                                className="w-full bg-slate-900 text-xs font-bold text-slate-300 p-2 border border-white/10 rounded focus:outline-none"
                                value={selectedStep}
                                onChange={(e) => setSelectedStep(parseInt(e.target.value))}
                            >
                                {resultMeta && Object.keys(resultMeta).length > 0 ? (
                                    // Extract steps from the first field that contains DEPL
                                    (resultMeta[Object.keys(resultMeta).find(k => k.includes("DEPL")) || ""] || [])
                                        .map((s: any, idx: number) => (
                                            <option key={idx} value={idx}>Step {idx} - {s[1]?.toExponential(2)}s</option>
                                        ))
                                ) : (
                                    <option>Awaiting result metadata...</option>
                                )}
                            </select>
                        </div>
                    </section>

                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <Label text="Deformation_Scale" icon={<Maximize2 size={12} />} />
                            <span className="text-[10px] font-black text-orange-500 font-mono italic">x{warpScale.toFixed(0)}</span>
                        </div>
                        <div className="bg-white/5 p-5 rounded-xl border border-white/5">
                            <input
                                type="range"
                                min="1"
                                max="1000"
                                step="1"
                                value={warpScale}
                                onChange={(e) => setWarpScale(parseFloat(e.target.value))}
                                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                            />
                            <div className="flex justify-between mt-3 text-[8px] font-mono text-slate-600">
                                <span>1:1</span>
                                <span>MAGNIFIED_x1000</span>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="p-4 bg-black/40 border-t border-white/5">
                    <button className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase text-slate-400 border border-white/5 transition-all">
                        <Download size={14} /> Export Technical Report
                    </button>
                </div>
            </div>

            <div className="flex-1 relative flex flex-col">
                <AnimatePresence>
                    {isLoading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-6"
                        >
                            <div className="flex gap-2">
                                {[0, 1, 2].map(i => (
                                    <motion.div
                                        key={i}
                                        animate={{ height: [8, 24, 8] }}
                                        transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                                        className="w-1 bg-orange-500 rounded-full"
                                    />
                                ))}
                            </div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] animate-pulse">Running_Post_Extraction</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex-1">
                    {meshData ? (
                        <VtkResultViewer
                            meshData={meshData}
                            physicsData={physicsData}
                            warpScale={warpScale}
                            fieldName={selectedField.toUpperCase()}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 gap-6">
                            <Monitor size={80} className="text-slate-500" />
                            <span className="text-[12px] font-black uppercase tracking-[0.8em]">Awaiting_Technical_Stream</span>
                        </div>
                    )}
                </div>

                <div className="h-10 px-6 bg-black/90 flex items-center justify-between text-[8px] font-mono text-slate-600 uppercase">
                    <div className="flex gap-6">
                        <span>Render: VTK_HEATMAP_MOD_V1</span>
                        <span>Engine: SALOME_MEDLOADER_BRIDGE</span>
                    </div>
                    {meshData && (
                        <div className="flex gap-4 items-center">
                            <BarChart3 size={12} className="text-emerald-500" />
                            <span>Elements: {meshData.num_elements || 0}</span>
                            <span>Nodes: {(meshData.points?.length || 0) / 3}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

const Label = ({ text, icon }: { text: string, icon: React.ReactNode }) => (
    <div className="flex items-center gap-3 opacity-50 px-1">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest leading-none">{text}</span>
    </div>
)

const FieldOption = ({ active, onClick, label, desc, icon }: { active: boolean, onClick: () => void, label: string, desc: string, icon: React.ReactNode }) => (
    <div
        onClick={onClick}
        className={`p-4 border rounded-xl cursor-pointer transition-all flex items-center gap-4 ${active ? 'bg-orange-500/10 border-orange-500/40 shadow-[inset_0_0_20px_rgba(249,115,22,0.05)]' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'}`}
    >
        <div className={`p-2 rounded-lg ${active ? 'bg-orange-500/20' : 'bg-black/20'}`}>
            {icon}
        </div>
        <div className="flex flex-col min-w-0">
            <span className={`text-[10px] font-black uppercase leading-none mb-1 ${active ? 'text-white' : 'text-slate-400'}`}>{label}</span>
            <span className="text-[8px] font-mono text-slate-500 italic truncate">{desc}</span>
        </div>
    </div>
)

export default PostProcessingTab
