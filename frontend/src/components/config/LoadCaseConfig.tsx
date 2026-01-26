import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface LoadCase {
    id: string
    name: string
    loads: string[]
    restrictions: string[]
}

interface LoadCaseConfigProps {
    projectPath: string | null
    availableLoads?: any[]
    availableRestrictions?: any[] // Explicit restrictions if available
    availableGroups?: string[] // Fallback to groups if restrictions not provided
    initialLoadCases?: any[]
    onUpdate?: (cases: any[]) => void
}

export default function LoadCaseConfig({
    projectPath,
    availableLoads = [],
    availableRestrictions = [],
    availableGroups = [],
    initialLoadCases = [],
    onUpdate
}: LoadCaseConfigProps) {
    const isFirstRender = useRef(true)
    const [cases, setCases] = useState<LoadCase[]>([])
    const lastInitializedPath = useRef<string | null>(null)

    // Sync from props only on project change or initial load
    useEffect(() => {
        if (!projectPath) return

        if (lastInitializedPath.current !== projectPath) {
            if (initialLoadCases && initialLoadCases.length > 0) {
                const formatted = initialLoadCases.map((lc, index) => ({
                    id: (index + 1).toString(),
                    name: lc.name,
                    loads: lc.loads || [],
                    restrictions: lc.restrictions || []
                }))
                setCases(formatted)
                lastInitializedPath.current = projectPath
            } else if (cases.length === 0) {
                setCases([{ id: '1', name: 'Case 1', loads: [], restrictions: [] }])
                lastInitializedPath.current = projectPath
            }
        }
    }, [projectPath, initialLoadCases])

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        if (onUpdate && projectPath === lastInitializedPath.current) {
            onUpdate(cases.map(c => ({
                name: c.name,
                loads: c.loads,
                restrictions: c.restrictions
            })))
        }
    }, [cases, onUpdate, projectPath])

    const addCase = () => {
        const newId = (cases.length + 1).toString()
        setCases([...cases, { id: newId, name: `Case ${newId}`, loads: [], restrictions: [] }])
    }

    const removeCase = (id: string) => {
        setCases(cases.filter(c => c.id !== id))
    }

    const updateName = (id: string, name: string) => {
        setCases(cases.map(c => c.id === id ? { ...c, name } : c))
    }

    const toggleItem = (caseId: string, field: 'loads' | 'restrictions', itemName: string) => {
        setCases(cases.map(c => {
            if (c.id !== caseId) return c

            const current = c[field] || []
            const hasItem = current.includes(itemName)
            const next = hasItem ? current.filter(i => i !== itemName) : [...current, itemName]

            return { ...c, [field]: next }
        }))
    }

    if (!projectPath) {
        return <div className="p-10 text-center text-slate-500">Please select a project.</div>
    }

    return (
        <div className="flex flex-col h-full w-full p-4 overflow-hidden">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                    <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                        <span className="p-2 bg-indigo-500/20 rounded text-indigo-400">📊</span>
                        Load Cases (Combinations)
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">Combine boundary conditions and structural loads.</p>
                </div>
                <button
                    onClick={addCase}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    New Case
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                {cases.map((lc) => (
                    <div key={lc.id} className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 shadow-xl hover:border-slate-600/50 transition-colors">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-700/50 pb-4">
                            <div className="flex-1 flex items-center gap-4">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700">
                                    CASE ID: {lc.id}
                                </span>
                                <input
                                    type="text"
                                    value={lc.name}
                                    onChange={(e) => updateName(lc.id, e.target.value)}
                                    className="bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2 text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all min-w-[300px]"
                                    placeholder="Enter case name..."
                                />
                            </div>
                            <button
                                onClick={() => removeCase(lc.id)}
                                className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                                title="Delete Case"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* SECTION: LOADS */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-blue-400">
                                    <Layers className="w-4 h-4" />
                                    <h4 className="text-xs font-bold uppercase tracking-widest">Included Loads</h4>
                                </div>
                                <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/30 flex flex-wrap gap-2 min-h-[60px]">
                                    {availableLoads.length === 0 ? (
                                        <span className="text-xs text-slate-600 italic">No loads available.</span>
                                    ) : (
                                        availableLoads.map((load) => {
                                            const isActive = lc.loads.includes(load.name)
                                            return (
                                                <button
                                                    key={load.name}
                                                    onClick={() => toggleItem(lc.id, 'loads', load.name)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${isActive
                                                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                                                        }`}
                                                >
                                                    {load.name}
                                                </button>
                                            )
                                        })
                                    )}
                                </div>
                            </div>

                            {/* SECTION: RESTRICTIONS (DDL) */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-orange-400">
                                    <button className="p-0 border-0 bg-transparent text-inherit cursor-default">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                    <h4 className="text-xs font-bold uppercase tracking-widest">Boundary Conditions (Restrictions)</h4>
                                </div>
                                <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/30 flex flex-wrap gap-2 min-h-[60px]">
                                    {availableRestrictions.length === 0 && availableGroups.length === 0 ? (
                                        <span className="text-xs text-slate-600 italic">No restrictions or groups found.</span>
                                    ) : (
                                        (availableRestrictions.length > 0 ? availableRestrictions : availableGroups).map((item) => {
                                            const name = typeof item === 'string' ? item : item.name
                                            const isActive = (lc.restrictions || []).includes(name)
                                            return (
                                                <button
                                                    key={name}
                                                    onClick={() => toggleItem(lc.id, 'restrictions', name)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${isActive
                                                        ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-500/20'
                                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                                                        }`}
                                                >
                                                    {name}
                                                </button>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

import { Layers } from 'lucide-react'
