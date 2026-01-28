import React, { useState, useMemo } from 'react'
import { 
    FileText, 
    CheckCircle, 
    AlertCircle, 
    Download, 
    Printer,
    Layers,
    Box,
    Settings,
    Database,
    Shield,
    Activity,
    ChevronDown,
    ChevronUp,
    Eye,
    EyeOff
} from 'lucide-react'

interface SummaryConfigProps {
    projectConfig: {
        geometries: any[]
        materials: any[]
        restrictions: any[]
        loads: any[]
        load_cases: any[]
        analysis?: any
        contacts?: any[]
        connections?: any[]
        post_elem_mass?: any
        post_releve_t_reactions?: any
    }
}

interface SectionStatus {
    complete: boolean
    items: number
    errors: string[]
}

interface SummarySection {
    id: string
    title: string
    icon: React.ComponentType<{ className?: string }>
    status: SectionStatus
    data: any[]
    renderContent: (data: any) => React.ReactNode
}

export default function SummaryConfig({ 
    projectConfig
}: SummaryConfigProps) {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['model', 'materials']))
    const [showDetails, setShowDetails] = useState(false)

    // Calculate section statuses
    const sectionStatuses = useMemo(() => {
        const statuses: Record<string, SectionStatus> = {}

        // Model & Mesh Status
        statuses.model = {
            complete: projectConfig.geometries.length > 0,
            items: projectConfig.geometries.length,
            errors: projectConfig.geometries.length === 0 ? ['No geometries defined'] : []
        }

        // Materials Status
        statuses.materials = {
            complete: projectConfig.materials.length > 0 && 
                     projectConfig.materials.every(m => m.E && m.nu && m.rho),
            items: projectConfig.materials.length,
            errors: projectConfig.materials.filter(m => !m.E || !m.nu || !m.rho)
                         .map(m => `Material ${m.name || 'unnamed'} missing properties`)
        }

        // Loads Status
        statuses.loads = {
            complete: projectConfig.loads.length > 0,
            items: projectConfig.loads.length,
            errors: projectConfig.loads.length === 0 ? ['No loads defined'] : []
        }

        // Restrictions Status
        statuses.restrictions = {
            complete: projectConfig.restrictions.length > 0,
            items: projectConfig.restrictions.length,
            errors: projectConfig.restrictions.length === 0 ? ['No restrictions defined'] : []
        }

        // Load Cases Status
        statuses.loadCases = {
            complete: projectConfig.load_cases.length > 0,
            items: projectConfig.load_cases.length,
            errors: projectConfig.load_cases.length === 0 ? ['No load cases defined'] : []
        }

        // Contacts Status
        statuses.contacts = {
            complete: !projectConfig.contacts || projectConfig.contacts.length === 0 || 
                     projectConfig.contacts.every(c => c.master && c.slave && c.type),
            items: projectConfig.contacts?.length || 0,
            errors: projectConfig.contacts?.filter(c => !c.master || !c.slave || !c.type)
                         .map(c => `Contact ${c.name || 'unnamed'} incomplete`) || []
        }

        // Analysis Status
        statuses.analysis = {
            complete: !!projectConfig.analysis?.type,
            items: 1,
            errors: !projectConfig.analysis?.type ? ['Analysis type not specified'] : []
        }

        return statuses
    }, [projectConfig])

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev)
            if (newSet.has(sectionId)) {
                newSet.delete(sectionId)
            } else {
                newSet.add(sectionId)
            }
            return newSet
        })
    }

    const exportToJSON = () => {
        const dataStr = JSON.stringify(projectConfig, null, 2)
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'simulation-config.json'
        link.click()
        URL.revokeObjectURL(url)
    }

    const printSummary = () => {
        window.print()
    }

    const getStatusColor = (status: SectionStatus) => {
        if (status.errors.length > 0) return 'text-rose-400 border-rose-500/30 bg-rose-500/10'
        if (status.complete) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
        return 'text-amber-400 border-amber-500/30 bg-amber-500/10'
    }

    const getStatusIcon = (status: SectionStatus) => {
        if (status.errors.length > 0) return <AlertCircle size={16} />
        if (status.complete) return <CheckCircle size={16} />
        return <AlertCircle size={16} />
    }

    // Section renderers
    const renderModelContent = (data: any[]) => (
        <div className="space-y-3">
            {data.map((geom, idx) => (
                <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white">{geom.group || 'Unnamed'}</span>
                        <span className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded border border-cyan-500/30">
                            {geom.type || 'Unknown'}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                        <div>File: {geom._meshFile || 'N/A'}</div>
                        <div>Physics: {geom.phenomenon || 'N/A'}</div>
                        <div>Category: {geom._category || 'N/A'}</div>
                        <div>Elements: {geom.count || 'N/A'}</div>
                    </div>
                </div>
            ))}
        </div>
    )

    const renderMaterialsContent = (data: any[]) => (
        <div className="space-y-3">
            {data.map((material, idx) => (
                <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white">{material.name || 'Unnamed'}</span>
                        <div className="flex gap-2">
                            {material.E && <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded">E</span>}
                            {material.nu && <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded">ν</span>}
                            {material.rho && <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded">ρ</span>}
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
                        <div>E: {material.E || 'N/A'} MPa</div>
                        <div>ν: {material.nu || 'N/A'}</div>
                        <div>ρ: {material.rho || 'N/A'} kg/m³</div>
                    </div>
                    {material.assignedGroups && material.assignedGroups.length > 0 && (
                        <div className="mt-2 text-xs text-slate-500">
                            Groups: {material.assignedGroups.join(', ')}
                        </div>
                    )}
                </div>
            ))}
        </div>
    )

    const renderLoadsContent = (data: any[]) => (
        <div className="space-y-3">
            {data.map((load, idx) => (
                <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white">{load.name || 'Unnamed'}</span>
                        <span className="text-xs px-2 py-1 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30">
                            {load.type || 'Unknown'}
                        </span>
                    </div>
                    <div className="text-xs text-slate-400">
                        <div>Group: {load.group || 'N/A'}</div>
                        <div>Magnitude: {load.magnitude || 'N/A'}</div>
                        {load.direction && <div>Direction: {load.direction}</div>}
                    </div>
                </div>
            ))}
        </div>
    )

    const renderRestrictionsContent = (data: any[]) => (
        <div className="space-y-3">
            {data.map((restriction, idx) => (
                <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white">{restriction.name || 'Unnamed'}</span>
                        <span className="text-xs px-2 py-1 bg-rose-500/20 text-rose-400 rounded border border-rose-500/30">
                            Constraint
                        </span>
                    </div>
                    <div className="text-xs text-slate-400">
                        <div>Group: {restriction.group || 'N/A'}</div>
                        <div>DOFs: {restriction.dofs || 'N/A'}</div>
                    </div>
                </div>
            ))}
        </div>
    )

    const renderLoadCasesContent = (data: any[]) => (
        <div className="space-y-3">
            {data.map((loadCase, idx) => (
                <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white">{loadCase.name || 'Unnamed'}</span>
                        <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded border border-purple-500/30">
                            Load Case
                        </span>
                    </div>
                    <div className="text-xs text-slate-400">
                        <div>Loads: {loadCase.loads?.length || 0}</div>
                        <div>Restrictions: {loadCase.restrictions?.length || 0}</div>
                    </div>
                </div>
            ))}
        </div>
    )

    const renderContactsContent = (data: any[]) => (
        <div className="space-y-3">
            {data.map((contact, idx) => (
                <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white">{contact.name || 'Unnamed'}</span>
                        <span className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded border border-cyan-500/30">
                            {contact.type || 'Unknown'}
                        </span>
                    </div>
                    <div className="text-xs text-slate-400">
                        <div>Master: {contact.master || 'N/A'}</div>
                        <div>Slave: {contact.slave || 'N/A'}</div>
                    </div>
                </div>
            ))}
        </div>
    )

    const renderAnalysisContent = (data: any) => (
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
            <div className="text-sm font-bold text-white mb-2">Analysis Configuration</div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                <div>Type: {data?.type || 'N/A'}</div>
                <div>Method: {data?.method || 'N/A'}</div>
                {data?.parameters && Object.entries(data.parameters).map(([key, value]) => (
                    <div key={key}>{key}: {String(value)}</div>
                ))}
            </div>
        </div>
    )

    // Define sections
    const sections: SummarySection[] = [
        {
            id: 'model',
            title: 'Model & Mesh',
            icon: Layers,
            status: sectionStatuses.model,
            data: projectConfig.geometries,
            renderContent: renderModelContent
        },
        {
            id: 'materials',
            title: 'Materials',
            icon: Database,
            status: sectionStatuses.materials,
            data: projectConfig.materials,
            renderContent: renderMaterialsContent
        },
        {
            id: 'loads',
            title: 'Loads',
            icon: Activity,
            status: sectionStatuses.loads,
            data: projectConfig.loads,
            renderContent: renderLoadsContent
        },
        {
            id: 'restrictions',
            title: 'Boundary Conditions',
            icon: Shield,
            status: sectionStatuses.restrictions,
            data: projectConfig.restrictions,
            renderContent: renderRestrictionsContent
        },
        {
            id: 'loadCases',
            title: 'Load Cases',
            icon: Box,
            status: sectionStatuses.loadCases,
            data: projectConfig.load_cases,
            renderContent: renderLoadCasesContent
        },
        ...(projectConfig.contacts ? [{
            id: 'contacts',
            title: 'Contacts',
            icon: Settings,
            status: sectionStatuses.contacts,
            data: projectConfig.contacts,
            renderContent: renderContactsContent
        }] : []),
        {
            id: 'analysis',
            title: 'Analysis Settings',
            icon: Settings,
            status: sectionStatuses.analysis,
            data: projectConfig.analysis,
            renderContent: renderAnalysisContent
        }
    ]

    const overallStatus = useMemo(() => {
        const allComplete = Object.values(sectionStatuses).every(s => s.complete)
        const hasErrors = Object.values(sectionStatuses).some(s => s.errors.length > 0)
        return { complete: allComplete, hasErrors }
    }, [sectionStatuses])

    return (
        <div className="h-full w-full bg-[#0B0F19] font-sans overflow-hidden">
            {/* Header */}
            <div className="h-16 shrink-0 border-b border-slate-800 flex items-center justify-between px-6 bg-gradient-to-r from-slate-900 to-transparent">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                        <FileText className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white">Configuration Summary</h2>
                        <p className="text-xs text-slate-500">Complete simulation configuration overview</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Overall Status */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                        overallStatus.complete 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    }`}>
                        {getStatusIcon(overallStatus.complete ? sectionStatuses.model : sectionStatuses.materials)}
                        <span className="text-xs font-bold">
                            {overallStatus.complete ? 'Configuration Complete' : 'Configuration Incomplete'}
                        </span>
                    </div>

                    {/* Actions */}
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-xs text-slate-300 transition-colors"
                    >
                        {showDetails ? <EyeOff size={14} /> : <Eye size={14} />}
                        {showDetails ? 'Simple View' : 'Detailed View'}
                    </button>

                    <button
                        onClick={exportToJSON}
                        className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg border border-cyan-500/30 text-cyan-400 text-xs transition-colors"
                    >
                        <Download size={14} />
                        Export JSON
                    </button>

                    <button
                        onClick={printSummary}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-xs text-slate-300 transition-colors"
                    >
                        <Printer size={14} />
                        Print
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-4">
                    {sections.map(section => {
                        const isExpanded = expandedSections.has(section.id)
                        const Icon = section.icon
                        const statusColor = getStatusColor(section.status)

                        return (
                            <div key={section.id} className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden">
                                {/* Section Header */}
                                <button
                                    onClick={() => toggleSection(section.id)}
                                    className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg border ${statusColor}`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="text-sm font-bold text-white">{section.title}</h3>
                                            <p className="text-xs text-slate-500">
                                                {section.status.items} {section.status.items === 1 ? 'item' : 'items'}
                                                {section.status.errors.length > 0 && ` • ${section.status.errors.length} errors`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {getStatusIcon(section.status)}
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </button>

                                {/* Section Content */}
                                {isExpanded && (
                                    <div className="border-t border-slate-800 p-4">
                                        {section.status.errors.length > 0 && (
                                            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <AlertCircle size={14} className="text-rose-400" />
                                                    <span className="text-xs font-bold text-rose-400">Issues Found</span>
                                                </div>
                                                <ul className="text-xs text-rose-300 space-y-1">
                                                    {section.status.errors.map((error, idx) => (
                                                        <li key={idx}>• {error}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {section.data && section.data.length > 0 ? (
                                            section.renderContent(section.data)
                                        ) : (
                                            <div className="text-center py-8 text-slate-600">
                                                <div className="text-xs font-bold uppercase mb-2">No Data</div>
                                                <div className="text-xs">No {section.title.toLowerCase()} configured</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
