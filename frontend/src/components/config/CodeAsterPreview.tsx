import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { FileCode2, Copy, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { commOrchestrator, type CommOrchestrationResult } from '../../lib/codeAster/orchestrator/commOrchestrator'

interface CodeAsterPreviewProps {
    projectConfig?: any
}

export default function CodeAsterPreview({ projectConfig }: CodeAsterPreviewProps) {
    const [isCodeOpen, setIsCodeOpen] = useState(true)
    const [activeSection, setActiveSection] = useState<'full' | 'mesh' | 'model' | 'geometry' | 'material' | 'load' | 'restriction' | 'meca' | 'post'>('full')

    // Generate orchestrated commands
    const orchestrationResult = useMemo((): CommOrchestrationResult | null => {
        if (!projectConfig) return null

        try {
            console.log('CodeAsterPreview - Orchestrating with projectConfig:', projectConfig)
            const result = commOrchestrator.orchestrateComm(projectConfig)
            console.log('CodeAsterPreview - Orchestration result:', result)
            return result
        } catch (error) {
            console.error('CodeAsterPreview - Orchestration error:', error)
            return null
        }
    }, [projectConfig])

    // Get content based on active section
    const getDisplayContent = (): string => {
        if (!orchestrationResult) return '# No project configuration available\n\nPlease configure your simulation parameters in the other tabs.'

        switch (activeSection) {
            case 'mesh':
                return orchestrationResult.meshSection
            case 'model':
                return orchestrationResult.modelSection
            case 'geometry':
                return orchestrationResult.geometrySection
            case 'material':
                return orchestrationResult.materialSection
            case 'load':
                return orchestrationResult.loadSection
            case 'restriction':
                return orchestrationResult.restrictionSection
            case 'meca':
                return orchestrationResult.mecaStatiqueSection
            case 'post':
                return orchestrationResult.postProcessingSection
            case 'full':
            default:
                return orchestrationResult.fullCommFile
        }
    }

    const displayContent = getDisplayContent()

    const sections = [
        { id: 'full', label: 'Complete .comm', icon: '📄' },
        { id: 'mesh', label: 'Mesh', icon: '🕸️' },
        { id: 'model', label: 'Model', icon: '🏗️' },
        { id: 'geometry', label: 'Geometry', icon: '📐' },
        { id: 'material', label: 'Materials', icon: '⚙️' },
        { id: 'restriction', label: 'Restrictions', icon: '🔒' },
        { id: 'load', label: 'Loads', icon: '⚡' },
        { id: 'meca', label: 'Analysis', icon: '🔬' },
        { id: 'post', label: 'Post-Process', icon: '📊' }
    ]

    return (
        <div className="h-full bg-slate-950 overflow-hidden flex flex-col">
            {/* Command Preview Window */}
            <div className="flex-1 p-6 overflow-hidden">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="h-full max-w-6xl mx-auto"
                >
                    <div className="bg-slate-900/40 border border-white/5 rounded-[2rem] overflow-hidden h-full flex flex-col">
                        {/* Header with Section Tabs */}
                        <div className="border-b border-white/5">
                            <button
                                onClick={() => setIsCodeOpen(!isCodeOpen)}
                                className="w-full flex items-center justify-between p-6 hover:bg-slate-900/60 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <FileCode2 className="w-5 h-5 text-cyan-400" />
                                    <div>
                                        <h3 className="text-sm font-black text-white uppercase tracking-wider">Orchestrated Commands</h3>
                                        <p className="text-[9px] text-slate-400 font-mono mt-1">
                                            {orchestrationResult
                                                ? `Complete .comm file (${orchestrationResult.fullCommFile.split('\n').length} lines)`
                                                : 'No project configuration'
                                            }
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className={`px-2 py-1 rounded text-[8px] font-black uppercase ${orchestrationResult
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                            : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                        }`}>
                                        {orchestrationResult ? 'Generated' : 'Waiting'}
                                    </div>
                                    {isCodeOpen ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                                </div>
                            </button>

                            {/* Section Tabs */}
                            {isCodeOpen && (
                                <div className="px-6 pb-4">
                                    <div className="flex gap-2 flex-wrap">
                                        {sections.map((section) => (
                                            <button
                                                key={section.id}
                                                onClick={() => setActiveSection(section.id as any)}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${activeSection === section.id
                                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                                        : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800'
                                                    }`}
                                            >
                                                <span>{section.icon}</span>
                                                <span>{section.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Code Content */}
                        {isCodeOpen && (
                            <div className="flex-1 overflow-hidden">
                                <div className="relative h-full group">
                                    {/* Action Buttons */}
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-2">
                                        <button
                                            onClick={() => navigator.clipboard.writeText(displayContent)}
                                            className="p-2 hover:bg-slate-800 rounded transition-colors text-slate-500 hover:text-white"
                                            title="Copy to clipboard"
                                        >
                                            <Copy className="w-3 h-3" />
                                        </button>
                                        {!orchestrationResult && (
                                            <div className="flex items-center gap-2 px-2 py-1 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded text-[8px] font-black uppercase">
                                                <AlertCircle className="w-3 h-3" />
                                                <span>Configure tabs</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Code Display */}
                                    <div className="h-full overflow-y-auto custom-scrollbar p-6">
                                        <pre className="text-[11px] font-mono text-slate-300 leading-relaxed">
                                            <code>{displayContent}</code>
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
