import { useState } from 'react'
import { motion } from 'framer-motion'
import { Building2, Ship, BookOpen, Settings as SettingsIcon } from 'lucide-react'
import SettingsModal from './Settings'

interface DashboardProps {
    onNavigate: (view: string) => void
}

export default function Dashboard({ onNavigate }: DashboardProps) {
    const [showSettings, setShowSettings] = useState(false)
    return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
            {/* Settings Button */}
            <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setShowSettings(true)}
                className="absolute top-6 right-6 p-3 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-slate-600 rounded-lg transition-all"
            >
                <SettingsIcon className="w-5 h-5 text-slate-400 hover:text-slate-200" />
            </motion.button>

            <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-5xl font-light mb-16 text-slate-100 tracking-tight"
            >
                ProSolve Professional
            </motion.h1>

            <div className="grid grid-cols-3 gap-8 max-w-6xl w-full">
                {/* Structural Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    onClick={() => onNavigate('structural')}
                    className="group relative bg-slate-800/50 backdrop-blur-sm hover:bg-slate-700/50 border border-slate-700 hover:border-blue-500 p-10 rounded-2xl cursor-pointer transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Building2 className="w-12 h-12 mb-6 text-blue-400 group-hover:text-blue-300 transition-colors" />
                    <h2 className="text-3xl font-bold mb-3 text-slate-100 group-hover:text-blue-300 transition-colors">
                        Structural
                    </h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        FEA Analysis & Modeling with Code_Aster
                    </p>
                </motion.div>

                {/* Marine Card (Disabled) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="relative bg-slate-800/30 border border-slate-800 p-10 rounded-2xl opacity-50 cursor-not-allowed"
                >
                    <Ship className="w-12 h-12 mb-6 text-slate-600" />
                    <h2 className="text-3xl font-bold mb-3 text-slate-500">Marine</h2>
                    <p className="text-slate-600 text-sm">Coming soon...</p>
                </motion.div>

                {/* Utility Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="group relative bg-slate-800/50 backdrop-blur-sm hover:bg-slate-700/50 border border-slate-700 hover:border-purple-500 p-10 rounded-2xl cursor-pointer transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <BookOpen className="w-12 h-12 mb-6 text-purple-400 group-hover:text-purple-300 transition-colors" />
                    <h2 className="text-3xl font-bold mb-3 text-slate-100 group-hover:text-purple-300 transition-colors">
                        Utility
                    </h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        Calculation Tools & Engineering Notebooks
                    </p>
                </motion.div>
            </div>

            {/* Settings Modal */}
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        </div>
    )
}
