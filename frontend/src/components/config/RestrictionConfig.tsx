import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface Restriction {
    id: string
    name: string
    group: string
    dx: boolean
    dy: boolean
    dz: boolean
    drx: boolean
    dry: boolean
    drz: boolean
}

interface RestrictionConfigProps {
    projectPath: string | null
    availableGroups?: string[]
    initialRestrictions?: any[]
    onUpdate?: (restrictions: any[]) => void
}

export default function RestrictionConfig({
    projectPath,
    availableGroups = [],
    initialRestrictions = [],
    onUpdate
}: RestrictionConfigProps) {
    const [restrictions, setRestrictions] = useState<Restriction[]>([])
    const isFirstRender = useRef(true)
    const lastExportRef = useRef('')

    // DEBUG LOG
    useEffect(() => {
        console.log("RESTRICTION_CHILD: Mounted. Initial Restrictions Prop:", initialRestrictions)
    }, [])

    useEffect(() => {
        console.log("RESTRICTION_CHILD: Internal State Updated:", restrictions)
    }, [restrictions])

    // Load initial restrictions if provided (Persistence)
    useEffect(() => {
        console.log("RESTRICTION_CHILD: Effect - initialRestrictions changed", initialRestrictions)
        if (initialRestrictions.length > 0) { // REMOVED restrictions.length === 0 check to force sync if needed, or check logic
            console.log("RESTRICTION_CHILD: Loading from props...")
            const formatted = initialRestrictions.map((r, index) => {
                // Reconstruct internal state structure from saved config structure
                // Saved: { name, group, dof: { DX: 0, ... } }
                return {
                    id: (index + 1).toString(),
                    name: r.name,
                    group: r.group,
                    dx: r.dof?.DX !== null,
                    dy: r.dof?.DY !== null,
                    dz: r.dof?.DZ !== null,
                    drx: r.dof?.DRX !== null,
                    dry: r.dof?.DRY !== null,
                    drz: r.dof?.DRZ !== null
                }
            })
            setRestrictions(formatted)
        }
    }, [initialRestrictions])

    useEffect(() => {
        // Prevent overwriting parent state on initial mount
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        if (onUpdate) {
            const exportData = restrictions.map(r => ({
                name: String(r.name || ''),
                group: String(r.group || ''),
                dof: {
                    DX: r.dx ? 0 : null,
                    DY: r.dy ? 0 : null,
                    DZ: r.dz ? 0 : null,
                    DRX: r.drx ? 0 : null,
                    DRY: r.dry ? 0 : null,
                    DRZ: r.drz ? 0 : null
                }
            }))

            // Simple stringification check to avoid redundant parent updates
            const currentString = JSON.stringify(exportData)
            if (lastExportRef.current !== currentString) {
                lastExportRef.current = currentString
                onUpdate(exportData)
            }
        }
    }, [restrictions, onUpdate])

    const addRestriction = () => {
        const newId = (restrictions.length + 1).toString()
        setRestrictions([
            ...restrictions,
            {
                id: newId,
                name: `Restriction_${newId}`,
                group: availableGroups[0] || '',
                dx: true,
                dy: true,
                dz: true,
                drx: false,
                dry: false,
                drz: false
            }
        ])
    }

    const removeRestriction = (id: string) => {
        setRestrictions(restrictions.filter(r => r.id !== id))
    }

    const updateRestriction = (id: string, field: keyof Restriction, value: any) => {
        setRestrictions(
            restrictions.map(r => (r.id === id ? { ...r, [field]: value } : r))
        )
    }

    if (!projectPath) {
        return <div className="p-10 text-center text-slate-500">Please select a project.</div>
    }

    return (
        <div className="flex flex-col h-full w-full p-4">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-200">Boundary Conditions (Restrictions)</h3>
                <button
                    onClick={addRestriction}
                    disabled={availableGroups.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50"
                >
                    <Plus className="w-4 h-4" />
                    Add Restriction
                </button>
            </div>

            {availableGroups.length === 0 && (
                <div className="text-center text-slate-400 p-10">
                    No mesh groups available. Please configure Model first.
                </div>
            )}

            {/* Restrictions List */}
            <div className="space-y-4 flex-1 overflow-y-auto">
                {restrictions.map((restriction) => (
                    <div
                        key={restriction.id}
                        className="bg-slate-800 border border-slate-700 rounded-lg p-4"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex-1 grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">
                                        Name
                                    </label>
                                    <input
                                        type="text"
                                        value={restriction.name}
                                        onChange={(e) => updateRestriction(restriction.id, 'name', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                                        placeholder="Restriction Name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">
                                        Mesh Group
                                    </label>
                                    <select
                                        value={restriction.group}
                                        onChange={(e) => updateRestriction(restriction.id, 'group', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                                    >
                                        {availableGroups.map((group) => (
                                            <option key={group} value={group}>
                                                {group}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <button
                                onClick={() => removeRestriction(restriction.id)}
                                className="ml-3 p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* DOF Checkboxes */}
                        <div className="border-t border-slate-700 pt-3">
                            <p className="text-xs text-slate-400 mb-2">Restricted Degrees of Freedom:</p>
                            <div className="grid grid-cols-6 gap-2">
                                {(['dx', 'dy', 'dz', 'drx', 'dry', 'drz'] as const).map((dof) => (
                                    <label
                                        key={dof}
                                        className="flex items-center gap-2 bg-slate-900/50 p-2 rounded cursor-pointer hover:bg-slate-900 transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={restriction[dof]}
                                            onChange={(e) => updateRestriction(restriction.id, dof, e.target.checked)}
                                            className="w-4 h-4 rounded border-slate-500 bg-slate-700 accent-purple-600"
                                        />
                                        <span className="text-xs font-mono uppercase">{dof}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
