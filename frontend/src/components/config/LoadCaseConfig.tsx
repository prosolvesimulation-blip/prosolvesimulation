import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface LoadCase {
    id: string
    name: string
    loads: string[] // List of load names included in this case
}

interface LoadCaseConfigProps {
    projectPath: string | null
    availableLoads?: any[] // List of defined load objects
    initialLoadCases?: any[]
    onUpdate?: (cases: any[]) => void
}

export default function LoadCaseConfig({
    projectPath,
    availableLoads = [],
    initialLoadCases = [],
    onUpdate
}: LoadCaseConfigProps) {
    const isFirstRender = useRef(true)
    const [cases, setCases] = useState<LoadCase[]>([
        { id: '1', name: 'Case 1', loads: [] }
    ])

    // Load initial
    useEffect(() => {
        if (initialLoadCases.length > 0) {
            const formatted = initialLoadCases.map((lc, index) => ({
                id: (index + 1).toString(),
                name: lc.name,
                loads: lc.loads || []
            }))
            setCases(formatted)
        }
    }, [initialLoadCases])

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        if (onUpdate) {
            onUpdate(cases.map(c => ({
                name: c.name,
                loads: c.loads
            })))
        }
    }, [cases, onUpdate])

    const addCase = () => {
        const newId = (cases.length + 1).toString()
        setCases([...cases, { id: newId, name: `Case ${newId}`, loads: [] }])
    }

    const removeCase = (id: string) => {
        setCases(cases.filter(c => c.id !== id))
    }

    const updateName = (id: string, name: string) => {
        setCases(cases.map(c => c.id === id ? { ...c, name } : c))
    }

    const toggleLoad = (caseId: string, loadName: string) => {
        setCases(cases.map(c => {
            if (c.id !== caseId) return c

            const hasLoad = c.loads.includes(loadName)
            let newLoads = []
            if (hasLoad) {
                newLoads = c.loads.filter(l => l !== loadName)
            } else {
                newLoads = [...c.loads, loadName]
            }
            return { ...c, loads: newLoads }
        }))
    }

    if (!projectPath) {
        return <div className="p-10 text-center text-slate-500">Please select a project.</div>
    }

    return (
        <div className="flex flex-col h-full w-full p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-200">Load Cases (Combinations)</h3>
                <button
                    onClick={addCase}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors text-sm"
                >
                    <Plus className="w-4 h-4" />
                    New Case
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
                {cases.map((lc) => (
                    <div key={lc.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-3">
                            <div className="flex-1 flex items-center gap-3">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900 px-2 py-1 rounded">
                                    CASE
                                </span>
                                <input
                                    type="text"
                                    value={lc.name}
                                    onChange={(e) => updateName(lc.id, e.target.value)}
                                    className="bg-slate-900 border border-slate-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500 text-slate-200 font-medium"
                                />
                            </div>
                            <button
                                onClick={() => removeCase(lc.id)}
                                className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-slate-400 mb-2 uppercase">Included Loads</p>
                            <div className="flex flex-wrap gap-2">
                                {availableLoads.length === 0 ? (
                                    <div className="text-xs text-slate-500 italic">No loads defined in configuration.</div>
                                ) : (
                                    availableLoads.map((load) => {
                                        const isActive = lc.loads.includes(load.name)
                                        return (
                                            <button
                                                key={load.name}
                                                onClick={() => toggleLoad(lc.id, load.name)}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs transition-all ${isActive
                                                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                                                    : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'
                                                    }`}
                                            >
                                                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-blue-400' : 'bg-slate-600'}`} />
                                                <span>{load.name}</span>
                                                <span className="opacity-50 text-[9px] uppercase ml-1">({load.type})</span>
                                            </button>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
