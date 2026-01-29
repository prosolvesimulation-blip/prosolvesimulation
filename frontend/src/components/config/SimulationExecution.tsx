import { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
    Play,
    ChevronDown,
    ChevronUp,
    Copy,
    Terminal,
    Settings,
    Zap,
    Clock,
    Database,
    Cpu,
    CheckCircle2,
    AlertCircle,
    FileCode2,
    Download
} from 'lucide-react'
import { commOrchestrator } from '../../lib/codeAster/orchestrator/commOrchestrator'

interface SimulationExecutionProps {
    projectPath: string | null
    projectConfig: any
    meshCommands: any
    modelCommands: any
    materialCommands: any
    loadCommands: any
    restrictionCommands: any
    onSimulationStart?: () => void
    onSimulationComplete?: (result: any) => void
}

interface SimulationStatus {
    phase: 'idle' | 'preparing' | 'generating' | 'validating' | 'executing' | 'completed' | 'error'
    progress: number
    message: string
    startTime?: Date
    endTime?: Date
}

export default function SimulationExecution({
    projectPath,
    projectConfig,
    meshCommands,
    modelCommands,
    materialCommands,
    loadCommands,
    restrictionCommands,
    onSimulationStart,
    onSimulationComplete
}: SimulationExecutionProps) {
    
    // DEBUG: Log incoming props
    console.log('🚀 SimulationExecution - Props Received:')
    console.log('   projectPath:', projectPath)
    console.log('   meshCommands:', meshCommands)
    console.log('   modelCommands:', modelCommands)
    console.log('   materialCommands:', materialCommands)
    console.log('   loadCommands:', loadCommands)
    console.log('   restrictionCommands:', restrictionCommands)
    
    const [isExpanded, setIsExpanded] = useState(false)
    const [simulationStatus, setSimulationStatus] = useState<SimulationStatus>({
        phase: 'idle',
        progress: 0,
        message: 'Ready to execute simulation'
    })
    const [showCommPreview, setShowCommPreview] = useState(() => {
        // Restore state from localStorage
        const saved = localStorage.getItem('simulation-comm-preview')
        return saved === 'true'
    })
    const [executionLog, setExecutionLog] = useState<string[]>([])
    const [persistedCommContent, setPersistedCommContent] = useState<string | null>(() => {
        // Restore .comm content from localStorage
        return localStorage.getItem('simulation-comm-content')
    })

    // Generate orchestration result when dependencies change
    const orchestration = useMemo(() => {
        console.log('🔄 SimulationExecution - Orchestration Update:')
        console.log('   projectConfig.model_commands:', projectConfig?.model_commands)
        console.log('   meshCommands.lireCommands:', meshCommands?.lireCommands?.length || 0)
        console.log('   meshCommands.asseCommands:', meshCommands?.asseCommands?.length || 0)
        console.log('   modelCommands.modeleCommands:', modelCommands?.modeleCommands?.length || 0)
        console.log('   materialCommands.defiCommands:', materialCommands?.defiCommands?.length || 0)
        console.log('   materialCommands.affeCommands:', materialCommands?.affeCommands?.length || 0)
        console.log('   loadCommands.forceCommands:', loadCommands?.forceCommands?.length || 0)
        console.log('   loadCommands.pressureCommands:', loadCommands?.pressureCommands?.length || 0)
        console.log('   loadCommands.gravityCommands:', loadCommands?.gravityCommands?.length || 0)
        console.log('   restrictionCommands.ddlCommands:', restrictionCommands?.ddlCommands?.length || 0)
        console.log('   restrictionCommands.faceCommands:', restrictionCommands?.faceCommands?.length || 0)
        console.log('   restrictionCommands.edgeCommands:', restrictionCommands?.edgeCommands?.length || 0)
        

        try {
            const result = commOrchestrator.orchestrateComm(projectConfig)
            
            console.log('📋 Generated Orchestration:')
            console.log('   fullCommFile length:', result?.fullCommFile?.length || 0)
            
            return result
        } catch (error) {
            console.error('❌ Orchestration error:', error)
            return null
        }
    }, [meshCommands, modelCommands, materialCommands, loadCommands, restrictionCommands, projectConfig])

    // Persist state to localStorage
    useEffect(() => {
        localStorage.setItem('simulation-comm-preview', showCommPreview.toString())
    }, [showCommPreview])

    useEffect(() => {
        if (orchestration && orchestration.fullCommFile) {
            localStorage.setItem('simulation-comm-content', orchestration.fullCommFile)
            setPersistedCommContent(orchestration.fullCommFile)
        }
    }, [orchestration])

    // Add log entry
    const addLog = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString()
        setExecutionLog(prev => [...prev, `[${timestamp}] ${message}`])
    }, [])

    // Update simulation status
    const updateStatus = useCallback((phase: SimulationStatus['phase'], message: string, progress?: number) => {
        setSimulationStatus(prev => ({
            ...prev,
            phase,
            message,
            progress: progress !== undefined ? progress : prev.progress,
            startTime: phase === 'preparing' && !prev.startTime ? new Date() : prev.startTime,
            endTime: phase === 'completed' || phase === 'error' ? new Date() : prev.endTime
        }))
        addLog(message)
    }, [addLog])

    // Execute simulation
    const executeSimulation = useCallback(async () => {
        if (!orchestration || !projectPath) {
            updateStatus('error', 'Missing project configuration')
            return
        }

        onSimulationStart?.()
        setExecutionLog([])

        try {
            // Phase 1: Preparation
            updateStatus('preparing', 'Preparing simulation environment...', 10)
            
            // Phase 2: .comm Generation
            updateStatus('generating', 'Generating .comm file...', 30)

            // Phase 3: Configuration Complete
            updateStatus('validating', 'Configuration complete...', 50)

            // Phase 4: Execution
            updateStatus('executing', 'Executing Code_Aster simulation...', 70)
            
            // Simulate backend execution (replace with actual API call)
            await new Promise(resolve => setTimeout(resolve, 2000))
            
            // Phase 5: Completion
            updateStatus('completed', 'Simulation completed successfully', 100)
            
            const result = {
                status: 'success',
                commFile: orchestration.fullCommFile,
                executionTime: (simulationStatus.endTime?.getTime() || 0) - (simulationStatus.startTime?.getTime() || 0),
                outputPath: `${projectPath}/output/calcul.resu`
            }
            
            onSimulationComplete?.(result)
            
        } catch (error) {
            updateStatus('error', `Simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
            console.error('Simulation error:', error)
        }
    }, [orchestration, projectPath, onSimulationStart, onSimulationComplete, updateStatus, simulationStatus.endTime, simulationStatus.startTime])

    // Get status color
    const getStatusColor = () => {
        switch (simulationStatus.phase) {
            case 'idle': return 'text-slate-400'
            case 'preparing':
            case 'generating':
            case 'validating':
            case 'executing': return 'text-blue-400'
            case 'completed': return 'text-emerald-400'
            case 'error': return 'text-red-400'
        }
    }

    // Get status icon
    const getStatusIcon = () => {
        switch (simulationStatus.phase) {
            case 'idle': return Terminal
            case 'preparing':
            case 'generating':
            case 'validating': return Settings
            case 'executing': return Cpu
            case 'completed': return CheckCircle2
            case 'error': return AlertCircle
        }
    }

    const StatusIcon = getStatusIcon()

    if (!projectPath) {
        return (
            <div className="p-8 text-center text-slate-500">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No project loaded</p>
            </div>
        )
    }

    return (
        <div className="h-full bg-slate-1000 overflow-y-auto p-8 font-sans">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-5xl mx-auto space-y-6"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                            <Zap className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Simulation Execution</h2>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Code_Aster MECA_STATIQUE</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowCommPreview(!showCommPreview)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border border-white/5 rounded-xl hover:bg-slate-800/50 transition-colors"
                        >
                            <FileCode2 className="w-4 h-4" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">.comm</span>
                        </button>
                        
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border border-white/5 rounded-xl hover:bg-slate-800/50 transition-colors"
                        >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Details</span>
                        </button>
                    </div>
                </div>

                {/* Status Panel */}
                <div className="p-6 bg-slate-900/50 border border-white/5 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <StatusIcon className={`w-5 h-5 ${getStatusColor()}`} />
                            <span className={`text-[11px] font-black uppercase tracking-widest ${getStatusColor()}`}>
                                {simulationStatus.phase}
                            </span>
                        </div>
                        
                        {simulationStatus.startTime && (
                            <div className="flex items-center gap-2 text-[9px] text-slate-400">
                                <Clock className="w-3 h-3" />
                                <span>
                                    {simulationStatus.endTime 
                                        ? `${((simulationStatus.endTime.getTime() - simulationStatus.startTime.getTime()) / 1000).toFixed(1)}s`
                                        : 'Running...'
                                    }
                                </span>
                            </div>
                        )}
                    </div>
                    
                    <div className="mb-3">
                        <div className="w-full bg-slate-800 rounded-full h-2">
                            <motion.div
                                className="bg-gradient-to-r from-blue-500 to-emerald-500 h-2 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${simulationStatus.progress}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>
                    </div>
                    
                    <p className="text-[10px] text-slate-400">{simulationStatus.message}</p>
                </div>

                {/* Execute Button */}
                <div className="flex justify-center">
                    <button
                        onClick={executeSimulation}
                        disabled={simulationStatus.phase === 'executing'}
                        className="flex items-center gap-3 px-8 py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <Play className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[12px] font-black text-emerald-300 uppercase tracking-widest">
                            {simulationStatus.phase === 'executing' ? 'Executing...' : 'Execute Simulation'}
                        </span>
                    </button>
                </div>


                {/* Expanded Details */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-4"
                        >
                            {/* Execution Log */}
                            {executionLog.length > 0 && (
                                <div className="p-4 bg-slate-900/50 border border-white/5 rounded-xl">
                                    <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3">Execution Log</h4>
                                    <div className="space-y-1 max-h-40 overflow-y-auto">
                                        {executionLog.map((log, index) => (
                                            <div key={index} className="text-[9px] font-mono text-slate-400">{log}</div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Configuration Summary */}
                            {orchestration && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-900/50 border border-white/5 rounded-xl">
                                        <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3">Mesh</h4>
                                        <div className="text-[9px] text-slate-400 space-y-1">
                                            <div>• {orchestration.meshSection.split('\n').filter(line => line.includes('LIRE_MAILLAGE')).length} mesh files</div>
                                            <div>• Final mesh: {meshCommands?.finalMeshName || 'MAIL'}</div>
                                        </div>
                                    </div>
                                    
                                    <div className="p-4 bg-slate-900/50 border border-white/5 rounded-xl">
                                        <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3">Loads</h4>
                                        <div className="text-[9px] text-slate-400 space-y-1">
                                            <div>• Forces: {loadCommands?.forceCommands?.length || 0}</div>
                                            <div>• Pressures: {loadCommands?.pressureCommands?.length || 0}</div>
                                            <div>• Gravity: {loadCommands?.gravityCommands?.length || 0}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Inline .comm Preview */}
                <AnimatePresence>
                    {showCommPreview && (orchestration || persistedCommContent) && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-white/5"
                        >
                            <div className="p-6 bg-slate-900/30">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <FileCode2 className="w-5 h-5 text-emerald-400" />
                                        <h3 className="text-lg font-black text-white">Generated .comm File</h3>
                                        <span className="text-[9px] text-slate-400 font-mono">
                                            {orchestration ? 'Live' : 'Persisted'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => navigator.clipboard.writeText(orchestration?.fullCommFile || persistedCommContent || '')}
                                            className="p-2 bg-slate-900/50 border border-white/5 rounded-lg hover:bg-slate-800/50 transition-colors"
                                            title="Copy to clipboard"
                                        >
                                            <Copy className="w-4 h-4 text-slate-400" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                const content = orchestration?.fullCommFile || persistedCommContent || ''
                                                const blob = new Blob([content], { type: 'text/plain' })
                                                const url = URL.createObjectURL(blob)
                                                const a = document.createElement('a')
                                                a.href = url
                                                a.download = 'calcul.comm'
                                                a.click()
                                                URL.revokeObjectURL(url)
                                            }}
                                            className="p-2 bg-slate-900/50 border border-white/5 rounded-lg hover:bg-slate-800/50 transition-colors"
                                            title="Download .comm file"
                                        >
                                            <Download className="w-4 h-4 text-slate-400" />
                                        </button>
                                        <button
                                            onClick={() => setShowCommPreview(false)}
                                            className="p-2 bg-slate-900/50 border border-white/5 rounded-lg hover:bg-slate-800/50 transition-colors"
                                            title="Hide .comm preview"
                                        >
                                            <ChevronUp className="w-4 h-4 text-slate-400" />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="bg-slate-950/50 border border-white/5 rounded-xl overflow-hidden">
                                    <div className="p-4 overflow-y-auto max-h-96">
                                        <pre className="text-[10px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                                            {orchestration?.fullCommFile || persistedCommContent || 'No .comm content available'}
                                        </pre>
                                    </div>
                                    
                                    {/* .comm file statistics */}
                                    <div className="px-4 py-2 bg-slate-900/50 border-t border-white/5">
                                        <div className="flex items-center justify-between text-[9px] text-slate-400">
                                            <span>
                                                Lines: {(orchestration?.fullCommFile || persistedCommContent || '').split('\n').length}
                                            </span>
                                            <span>
                                                Size: {new Blob([orchestration?.fullCommFile || persistedCommContent || '']).size} bytes
                                            </span>
                                            <span>
                                                Status: ✅ Ready
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    )
}
