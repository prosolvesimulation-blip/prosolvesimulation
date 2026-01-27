import { motion } from 'framer-motion'
import { FileCode, Layers, Info, CheckCircle2, Database, Box, User } from 'lucide-react'

interface MeshConfigProps {
    projectPath: string | null
    meshes: string[]
    meshGroups?: any // { "file.med": { "GroupName": { count: 10, category: "3D", types: { "HEXA8": 10 } } } }
}

export default function MeshConfig({ projectPath, meshes, meshGroups = {} }: MeshConfigProps) {
    if (!projectPath) return null

    return (
        <div className="h-full bg-slate-1000 overflow-y-auto p-8 font-sans">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-5xl mx-auto space-y-10"
            >
                {/* Header Section */}
                <div className="flex items-center justify-between border-b border-white/5 pb-8">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-lg shadow-blue-500/5">
                            <Database size={28} className="text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white uppercase tracking-tight">Mesh Topology</h2>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1 opacity-70">Project Source & Entity Inspection</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/50 border border-white/5 rounded-xl">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{meshes.length} Files Detected</span>
                    </div>
                </div>

                {meshes.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="py-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-[2rem] bg-slate-900/10"
                    >
                        <FileCode size={60} className="text-slate-800 mb-6" />
                        <h3 className="text-sm font-black text-slate-600 uppercase tracking-[0.4em]">Null_Source_Detected</h3>
                        <p className="text-[10px] text-slate-700 font-mono mt-2">Place .med mesh files in the project folder to begin.</p>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 gap-8">
                        {meshes.map((meshName, idx) => {
                            const groupsInFile = meshGroups[meshName] || {}
                            const groupCount = Object.keys(groupsInFile).length

                            return (
                                <motion.div
                                    key={meshName}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="bg-slate-900/40 border border-white/5 rounded-[2rem] overflow-hidden group hover:border-blue-500/30 transition-all duration-500"
                                >
                                    <div className="p-8 flex flex-col md:flex-row gap-8">
                                        {/* File Brief */}
                                        <div className="md:w-72 shrink-0 space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                                                    <FileCode size={20} />
                                                </div>
                                                <span className="text-sm font-black text-white truncate max-w-[200px]" title={meshName}>
                                                    {meshName}
                                                </span>
                                            </div>

                                            <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Status</span>
                                                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-400/10 px-2 py-0.5 rounded">Linked</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Groups</span>
                                                    <span className="text-[9px] font-black text-white font-mono">{groupCount}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/10">
                                                <CheckCircle2 size={14} className="text-blue-500" />
                                                <span className="text-[9px] font-bold text-blue-300 uppercase italic">Validated by MED_DNA</span>
                                            </div>
                                        </div>

                                        {/* Groups Visualization */}
                                        <div className="flex-1 space-y-6">
                                            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                                <Layers size={14} className="text-slate-500" />
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Topology_Inventory</h4>
                                            </div>

                                            {groupCount === 0 ? (
                                                <div className="p-8 text-center bg-black/20 rounded-2xl border border-dashed border-slate-800">
                                                    <p className="text-[10px] font-mono text-slate-600 italic">No named groups found in this mesh file.</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {Object.entries(groupsInFile).map(([gName, info]: [string, any]) => (
                                                        <div
                                                            key={gName}
                                                            className="flex items-center justify-between p-3 bg-slate-950/50 border border-white/5 rounded-xl hover:bg-blue-500/5 transition-colors group/item"
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className={`p-1.5 rounded-md ${info.category === 'Node' ? 'bg-slate-800 text-slate-500' : 'bg-blue-500/10 text-blue-400'}`}>
                                                                    {info.category === 'Node' ? <User size={10} /> : <Box size={10} />}
                                                                </div>
                                                                <div>
                                                                    <div className="text-[10px] font-black text-slate-300 truncate tracking-tight group-hover/item:text-white transition-colors" title={gName}>
                                                                        {gName}
                                                                    </div>
                                                                    {((info.types && Object.keys(info.types).length > 0) || info.med_type) && (
                                                                        <div className="text-[7px] font-mono text-slate-500 uppercase flex items-center gap-1.5 mt-1">
                                                                            {info.med_type && (
                                                                                <div className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded">
                                                                                    <span className="text-emerald-400 font-black text-[9px]">{info.med_type}</span>
                                                                                </div>
                                                                            )}
                                                                            {info.med_type && info.types && Object.keys(info.types).length > 0 && <span>|</span>}
                                                                            {info.types && Object.entries(info.types).map(([t, q]) => (
                                                                                <span key={String(t)}>{String(t)}:{String(q)}</span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <span className="text-[8px] font-mono text-slate-600 font-bold ml-2">
                                                                {info.count}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                )}

                {/* Footer Info */}
                <div className="flex items-start gap-4 p-6 bg-slate-900/30 rounded-3xl border border-white/5 text-slate-500 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-1 bg-yellow-500/5 blur-2xl rounded-full" />
                    <Info size={18} className="text-slate-600 mt-1 shrink-0" />
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none mb-1">Environmental_Notice</p>
                        <p className="text-[10px] font-medium leading-relaxed">
                            ProSolve synchronizes source meshes using the <b>MED DNA Pipeline</b>. Groups listed here are automatically indexed for the <b>Model</b> and <b>Materials</b> tabs. Ensure your mesh export from Salome includes "Group on Nodes" and "Group on Elements" for full functionality.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
