import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface Load {
    id: string
    name: string
    type: 'gravity' | 'force' | 'pressure'
    group?: string
    fx?: string
    fy?: string
    fz?: string
    pressure?: string
}

interface LoadConfigProps {
    projectPath: string | null
    availableGroups?: string[]
    initialLoads?: any[]
    onUpdate?: (loads: any[]) => void
}

export default function LoadConfig({
    projectPath,
    availableGroups = [],
    initialLoads = [],
    onUpdate
}: LoadConfigProps) {
    const [loads, setLoads] = useState<Load[]>([])
    const isFirstRender = useRef(true)

    // Load initial from props
    useEffect(() => {
        if (initialLoads.length > 0 && loads.length === 0) {
            const formatted = initialLoads.map((l, index) => {
                // Map saved JSON back to UI state
                let type: 'gravity' | 'force' | 'pressure' = 'force'
                if (l.type === 'PESANTEUR') type = 'gravity'
                else if (l.type === 'PRESSION') type = 'pressure'

                return {
                    id: (index + 1).toString(),
                    name: l.name,
                    type: type,
                    group: l.group || '',
                    fx: l.fx?.toString() || '0',
                    fy: l.fy?.toString() || '0',
                    fz: l.fz?.toString() || '0',
                    pressure: l.pressure?.toString() || '0'
                }
            })
            setLoads(formatted)
        }
    }, [initialLoads])

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        if (onUpdate) {
            const exportData = loads.map(l => {
                if (l.type === 'gravity') {
                    return {
                        name: l.name,
                        type: 'PESANTEUR',
                        direction: [0, 0, -1],
                        gravity: 9.81
                    }
                } else if (l.type === 'force') {
                    return {
                        name: l.name,
                        type: 'FORCE_NODALE',
                        group: l.group,
                        fx: parseFloat(l.fx || '0'),
                        fy: parseFloat(l.fy || '0'),
                        fz: parseFloat(l.fz || '0')
                    }
                } else {
                    return {
                        name: l.name,
                        type: 'PRESSION',
                        group: l.group,
                        pressure: parseFloat(l.pressure || '0')
                    }
                }
            })
            onUpdate(exportData)
        }
    }, [loads, onUpdate])

    const addLoad = (type: 'gravity' | 'force' | 'pressure') => {
        const newId = (loads.length + 1).toString()
        const baseName = type === 'gravity' ? 'PESANTEUR' : type === 'force' ? 'Force' : 'Pressure'

        setLoads([
            ...loads,
            {
                id: newId,
                name: `${baseName}_${newId}`,
                type,
                group: availableGroups[0] || '',
                fx: '0',
                fy: '0',
                fz: '0',
                pressure: '0'
            }
        ])
    }

    const removeLoad = (id: string) => {
        setLoads(loads.filter(l => l.id !== id))
    }

    const updateLoad = (id: string, field: keyof Load, value: any) => {
        setLoads(loads.map(l => (l.id === id ? { ...l, [field]: value } : l)))
    }

    if (!projectPath) {
        return <div className="p-10 text-center text-slate-500">Please select a project.</div>
    }

    return (
        <div className="flex flex-col h-full w-full p-4">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-200">Load Definitions</h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => addLoad('gravity')}
                        className="flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Gravity
                    </button>
                    <button
                        onClick={() => addLoad('force')}
                        disabled={availableGroups.length === 0}
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors text-sm disabled:opacity-50"
                    >
                        <Plus className="w-4 h-4" />
                        Force
                    </button>
                    <button
                        onClick={() => addLoad('pressure')}
                        disabled={availableGroups.length === 0}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors text-sm disabled:opacity-50"
                    >
                        <Plus className="w-4 h-4" />
                        Pressure
                    </button>
                </div>
            </div>

            {/* Loads List */}
            <div className="space-y-4 flex-1 overflow-y-auto">
                {loads.map((load) => (
                    <div
                        key={load.id}
                        className="bg-slate-800 border border-slate-700 rounded-lg p-4"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${load.type === 'gravity' ? 'bg-orange-500/20 text-orange-400' :
                                        load.type === 'force' ? 'bg-green-500/20 text-green-400' :
                                            'bg-blue-500/20 text-blue-400'
                                        }`}>
                                        {load.type.toUpperCase()}
                                    </span>
                                    <input
                                        type="text"
                                        value={load.name}
                                        onChange={(e) => updateLoad(load.id, 'name', e.target.value)}
                                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500"
                                        placeholder="Load Name"
                                    />
                                </div>

                                {load.type !== 'gravity' && (
                                    <div className="mb-3">
                                        <label className="block text-xs font-medium text-slate-400 mb-1">
                                            Mesh Group
                                        </label>
                                        <select
                                            value={load.group}
                                            onChange={(e) => updateLoad(load.id, 'group', e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                                        >
                                            {availableGroups.map((group) => (
                                                <option key={group} value={group}>
                                                    {group}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {load.type === 'gravity' && (
                                    <p className="text-xs text-slate-500">
                                        Self-weight load (Direction: -Z, g = 9.81 m/s²)
                                    </p>
                                )}

                                {load.type === 'force' && (
                                    <div className="grid grid-cols-3 gap-3">
                                        {(['fx', 'fy', 'fz'] as const).map((dir) => (
                                            <div key={dir}>
                                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                                    {dir.toUpperCase()} (N)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={load[dir]}
                                                    onChange={(e) => updateLoad(load.id, dir, e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                                                    placeholder="0"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {load.type === 'pressure' && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">
                                            Pressure (Pa)
                                        </label>
                                        <input
                                            type="number"
                                            value={load.pressure}
                                            onChange={(e) => updateLoad(load.id, 'pressure', e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                                            placeholder="0"
                                        />
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => removeLoad(load.id)}
                                className="ml-3 p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {loads.length === 0 && (
                    <div className="text-center text-slate-400 p-10">
                        No loads defined. Click a button above to add loads.
                    </div>
                )}
            </div>
        </div>
    )
}
