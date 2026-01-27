import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Building2,
    Ship,
    BookOpen,
    Settings as SettingsIcon,
    Box,
    Grid,
    Terminal,
    Calculator,
    Code2,
    Sigma
} from 'lucide-react'
import SettingsModal from './Settings'

interface DashboardProps {
    onNavigate: (view: string) => void
}

export default function Dashboard({ onNavigate }: DashboardProps) {
    const [showSettings, setShowSettings] = useState(false)
    const [showUtility, setShowUtility] = useState(false)

    return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-[#0B0F19] p-8 relative overflow-hidden font-sans">
            {/* Background Ambience */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,24,40,1),#000000)] pointer-events-none" />
            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none" />

            {/* Header / Brand */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="z-10 text-center mb-16 space-y-2"
            >
                <h1 className="text-6xl font-extralight text-white tracking-tighter">
                    ProSolve <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Simulation</span>
                </h1>
                <p className="text-slate-500 font-mono text-xs uppercase tracking-[0.4em]">Advanced Multiphysics Engineering Environment</p>
            </motion.div>

            {/* Settings Button */}
            <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setShowSettings(true)}
                className="absolute top-8 right-8 p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full backdrop-blur-md transition-all z-20"
            >
                <SettingsIcon className="w-5 h-5 text-slate-400 hover:text-white" />
            </motion.button>

            {/* Main Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl w-full z-10 px-12">

                {/* 1. STRUCTURAL MODULE */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    onClick={() => onNavigate('structural')}
                    className="group relative bg-gradient-to-b from-slate-900 to-[#050505] border border-white/5 p-8 rounded-3xl cursor-pointer hover:border-blue-500/50 transition-all duration-500 shadow-2xl hover:shadow-[0_0_50px_rgba(59,130,246,0.15)] overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-32 bg-blue-500/10 blur-[100px] rounded-full group-hover:bg-blue-500/20 transition-all" />

                    <div className="relative z-10">
                        <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 group-hover:bg-blue-500 group-hover:text-black transition-all">
                            <Building2 className="w-7 h-7 text-blue-400 group-hover:text-black transition-colors" />
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2">ProSolve Structural</h2>
                        <p className="text-slate-500 text-sm leading-relaxed mb-8">
                            Complete FEA workflow powered by generic solvers. Mesh extrusion and mechanical qualification.
                        </p>

                        {/* Integration Badges */}
                        <div className="flex gap-3 flex-wrap">
                            <Badge icon={<Box size={12} />} label="FreeCAD" color="text-red-400" border="border-red-500/20" bg="bg-red-500/10" />
                            <Badge icon={<Grid size={12} />} label="Salome_Meca" color="text-amber-400" border="border-amber-500/20" bg="bg-amber-500/10" />
                            <Badge icon={<Code2 size={12} />} label="Code_Aster" color="text-cyan-400" border="border-cyan-500/20" bg="bg-cyan-500/10" />
                        </div>
                    </div>
                </motion.div>

                {/* 2. MARINE MODULE (Disabled) */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="relative bg-gradient-to-b from-slate-900 to-[#050505] border border-white/5 p-8 rounded-3xl opacity-40 grayscale cursor-not-allowed"
                >
                    <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                        <Ship className="w-7 h-7 text-slate-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-500 mb-2">ProSolve Marine</h2>
                    <p className="text-slate-600 text-sm leading-relaxed"> Hydrodynamics and buoyancy simulation suite. </p>
                    <div className="mt-8 inline-block px-3 py-1 bg-white/5 rounded-full text-[10px] font-mono uppercase tracking-widest text-slate-500">Coming Soon</div>
                </motion.div>

                {/* 3. UTILITY HUB */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    onClick={() => setShowUtility(true)}
                    className="group relative bg-gradient-to-b from-slate-900 to-[#050505] border border-white/5 p-8 rounded-3xl cursor-pointer hover:border-purple-500/50 transition-all duration-500 shadow-2xl hover:shadow-[0_0_50px_rgba(168,85,247,0.15)] overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-32 bg-purple-500/10 blur-[100px] rounded-full group-hover:bg-purple-500/20 transition-all" />

                    <div className="relative z-10">
                        <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/20 group-hover:bg-purple-500 group-hover:text-black transition-all">
                            <BookOpen className="w-7 h-7 text-purple-400 group-hover:text-black transition-colors" />
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2">Utility Hub</h2>
                        <p className="text-slate-500 text-sm leading-relaxed mb-8">
                            Essential engineering calculators, notebooks, and mathematical solvers.
                        </p>

                        <div className="flex gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <div className="h-1.5 w-1.5 rounded-full bg-pink-500" />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Utility Modal Overlay */}
            <AnimatePresence>
                {showUtility && (
                    <motion.div
                        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
                        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        onClick={() => setShowUtility(false)}
                        className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-20"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#0F1218] border border-white/10 p-12 rounded-[2rem] shadow-2xl max-w-5xl w-full"
                        >
                            <div className="text-center mb-12">
                                <h3 className="text-3xl font-light text-white mb-2">Engineering Utilities</h3>
                                <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">Select your computational environment</p>
                            </div>

                            <div className="grid grid-cols-4 gap-6">
                                <ToolCard icon={<Terminal size={24} />} name="Jupyter" desc="Python Notebooks" color="text-orange-400" hover="hover:border-orange-500/50" />
                                <ToolCard icon={<Calculator size={24} />} name="CalcPad" desc="Engineering Math" color="text-blue-400" hover="hover:border-blue-500/50" />
                                <ToolCard icon={<Code2 size={24} />} name="Spyder" desc="Scientific IDE" color="text-red-400" hover="hover:border-red-500/50" />
                                <ToolCard icon={<Sigma size={24} />} name="MatSolve" desc="Matrix Solver" color="text-emerald-400" hover="hover:border-emerald-500/50" />
                            </div>

                            <button onClick={() => setShowUtility(false)} className="mx-auto mt-12 block text-xs font-bold text-slate-500 hover:text-white uppercase tracking-widest transition-colors">
                                Close Overlay
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Settings Modal */}
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        </div>
    )
}

// Sub-components
const Badge = ({ icon, label, color, border, bg }: any) => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${border} ${bg} ${color}`}>
        {icon}
        <span className="text-[10px] font-black uppercase tracking-wide">{label}</span>
    </div>
)

const ToolCard = ({ icon, name, desc, color, hover }: any) => (
    <div className={`group bg-white/5 border border-white/5 rounded-2xl p-6 text-center cursor-pointer transition-all ${hover} hover:bg-white/10`}>
        <div className={`mx-auto w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center mb-4 ${color} group-hover:scale-110 transition-transform`}>
            {icon}
        </div>
        <h4 className="text-white font-bold mb-1">{name}</h4>
        <p className="text-slate-500 text-[10px] uppercase tracking-wider">{desc}</p>
    </div>
)
