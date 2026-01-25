import { useState, useEffect, useRef } from 'react'
import { Check, X } from 'lucide-react'

interface MeshGroup {
    name: string
    meshFile: string // NEW: Source identification
    selected: boolean
    count: number
    composition: string
    category: string
    model: string
    phenomenon: string
}

interface ModelConfigProps {
    projectPath: string | null
    meshGroups?: any // NEW: Provided by StructuralWorkspace
    currentGeometries?: any[]
    onUpdate?: (geometries: any[]) => void
}

const MODEL_OPTIONS = {
    '1D': [
        { value: 'POU_D_T', label: 'Beam (Timoshenko) - POU_D_T' },
        { value: 'POU_D_E', label: 'Beam (Euler) - POU_D_E' },
        { value: 'BARRE', label: 'Truss/Bar - BARRE' },
        { value: 'CABLE', label: 'Cable - CABLE' }
    ],
    '2D': [
        { value: 'DKT', label: 'Plate (Thin) - DKT' },
        { value: 'DST', label: 'Plate (Thick) - DST' },
        { value: 'COQUE_3D', label: 'Shell 3D - COQUE_3D' },
        { value: 'MEMBRANE', label: 'Membrane - MEMBRANE' },
        { value: 'C_PLAN', label: 'Plane Strain - C_PLAN' },
        { value: 'D_PLAN', label: 'Plane Stress - D_PLAN' },
        { value: 'AXIS', label: 'Axisymmetric - AXIS' }
    ],
    '3D': [
        { value: '3D', label: 'Solid/Volume - 3D' }
    ]
}

export default function ModelConfig({ projectPath, meshGroups, currentGeometries = [], onUpdate }: ModelConfigProps) {
    const [groups, setGroups] = useState<MeshGroup[]>([])
    const isFirstRender = useRef(true)
    const lastGroupsSignatureRef = useRef<string>('')
    const lastExportSignatureRef = useRef<string>('')

    useEffect(() => {
        if (meshGroups) {
            // console.log("🔍 [DEBUG MODEL] Component Props meshGroups:", meshGroups); // Removed redundant log
            // console.log("🔍 [DEBUG MODEL] Global State meshes:", (window as any).projectState?.meshes); // Removed redundant log
        }
    }, [meshGroups]);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        if (onUpdate) {
            const exportData = groups
                .filter(g => g.selected)
                .map(g => ({
                    group: g.name,
                    _meshFile: g.meshFile, // Internal tracking
                    // ...MERGE logic
                    ...(() => {
                        const existing = currentGeometries.find(c => c.group === g.name && c._meshFile === g.meshFile) || {}
                        return {
                            ...existing,
                            type: g.model,
                            formulation: (g.model === 'DKT' || g.model === 'DST') ? g.model : undefined,
                            phenomenon: 'MECANIQUE',
                            _category: g.category
                        }
                    })()
                }))

            // Stability check: Only update parent if serialized data changed
            const expSignature = JSON.stringify(exportData)
            if (expSignature !== lastExportSignatureRef.current) {
                lastExportSignatureRef.current = expSignature
                onUpdate(exportData)
            }
        }
    }, [groups, onUpdate])

    // React to prop changes independently
    useEffect(() => {
        if (meshGroups) {
            // PERFORMANCE PROTOCOL: Signature-based check (only files and group names)
            // This prevents the infinite loop while remaining extremely fast
            const signature = JSON.stringify(Object.entries(meshGroups).map(([file, groups]: [string, any]) => ({
                file,
                groups: Object.keys(groups).sort()
            })))

            if (signature === lastGroupsSignatureRef.current) {
                return // Structure hasn't changed, skip re-mapping to stop loop
            }
            lastGroupsSignatureRef.current = signature

            console.log("MODEL_CHILD: Mapping independent meshGroups keys:", Object.keys(meshGroups))
            const loadedGroups: MeshGroup[] = []

            // Iterate through each mesh file independently
            Object.entries(meshGroups).forEach(([fileName, groupsInFile]: [string, any]) => {
                Object.entries(groupsInFile).forEach(([groupName, info]: [string, any]) => {
                    const category = info.category || detectCategory(info.types || {})
                    const compStr = info.types ? Object.entries(info.types)
                        .map(([t, q]) => `${t}:${q}`)
                        .join(', ') : category

                    const existingConfig = currentGeometries.find((c: any) => c.group === groupName && c._meshFile === fileName)

                    loadedGroups.push({
                        name: groupName,
                        meshFile: fileName,
                        selected: currentGeometries.length > 0 ? !!existingConfig : true,
                        count: info.count,
                        composition: compStr,
                        category: category,
                        model: existingConfig?.type || detectDefaultModel(category),
                        phenomenon: 'MECANIQUE'
                    })
                })
            })
            setGroups(loadedGroups)
        }
    }, [meshGroups, currentGeometries])

    const detectCategory = (typesObj: any): string => {
        const types = Object.keys(typesObj)
        if (types.some(t => t === 'Node')) return 'Node'
        if (types.some(t => t.includes('HEXA') || t.includes('TETRA') || t.includes('PENTA'))) return '3D'
        if (types.some(t => t.includes('QUAD') || t.includes('TRIA'))) return '2D'
        if (types.some(t => t.includes('SEG'))) return '1D'
        return '3D'
    }

    const detectDefaultModel = (category: string): string => {
        if (category === 'Node') return 'Node'
        if (category === '3D') return '3D'
        if (category === '2D') return 'COQUE_3D'
        if (category === '1D') return 'POU_D_T'
        return '3D'
    }

    // REDUNDANT INTERNAL FETCH REMOVED (Centralized in StructuralWorkspace)
    // const loadMeshGroups = async () => { ... }

    const handleCheckboxChange = (index: number) => {
        const newGroups = [...groups]
        newGroups[index].selected = !newGroups[index].selected
        setGroups(newGroups)
    }

    const handleModelChange = (index: number, newModel: string) => {
        const newGroups = [...groups]
        newGroups[index].model = newModel
        setGroups(newGroups)
    }

    const toggleAll = (select: boolean) => {
        const newGroups = groups.map(g => ({ ...g, selected: select }))
        setGroups(newGroups)
    }

    if (!projectPath) {
        return <div className="p-10 text-center text-slate-500">Please select a project.</div>
    }

    if (groups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-10 text-slate-400">
                <div className="text-4xl mb-4 text-slate-600">🕸️</div>
                <h3 className="text-xl font-bold text-slate-300 mb-2">No Mesh Groups Detected</h3>
                <p className="mb-6 text-center max-w-md text-sm">Please scan workspace first from the Toolbar.</p>
                <button
                    onClick={() => window.location.reload()} // Simple fallback as parent should handle refresh
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors border border-slate-600"
                >
                    Refresh Data
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                <div className="flex gap-2">
                    <button
                        onClick={() => toggleAll(true)}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded transition-colors flex items-center gap-1"
                    >
                        <Check className="w-3 h-3" />
                        Check All
                    </button>
                    <button
                        onClick={() => toggleAll(false)}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded transition-colors flex items-center gap-1"
                    >
                        <X className="w-3 h-3" />
                        Uncheck All
                    </button>
                </div>
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                    Model Definition
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden shadow-xl flex-1 flex flex-col">
                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase tracking-wider sticky top-0 z-10">
                            <tr>
                                <th className="p-3 w-12 text-center border-b border-slate-800">Sel.</th>
                                <th className="p-3 w-1/4 border-b border-slate-800">Mesh Source</th>
                                <th className="p-3 w-1/4 border-b border-slate-800">Group Name</th>
                                <th className="p-3 w-1/4 border-b border-slate-800">Composition</th>
                                <th className="p-3 w-1/4 border-b border-slate-800">Model Definition</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-700/50 text-sm">
                            {groups.map((group, idx) => {
                                if (group.category === 'Node' || group.category === 'Point') return null

                                return (
                                    <tr
                                        key={idx}
                                        className={`transition-colors hover:bg-slate-700/30 ${!group.selected ? 'opacity-50 grayscale-[50%]' : ''
                                            }`}
                                    >
                                        <td className="p-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={group.selected}
                                                onChange={() => handleCheckboxChange(idx)}
                                                className="w-4 h-4 rounded border-slate-500 bg-slate-700 accent-blue-600 cursor-pointer"
                                            />
                                        </td>

                                        <td className="p-3 text-xs font-mono text-slate-500 truncate max-w-[120px]" title={group.meshFile}>
                                            {group.meshFile}
                                        </td>

                                        <td className="p-3 font-mono font-medium text-blue-300">
                                            {group.name}
                                        </td>

                                        <td className="p-3 text-xs text-slate-400 font-mono">
                                            {group.composition}
                                        </td>

                                        <td className="p-3">
                                            <select
                                                value={group.model}
                                                onChange={(e) => handleModelChange(idx, e.target.value)}
                                                disabled={!group.selected}
                                                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none disabled:cursor-not-allowed transition-colors hover:border-slate-500"
                                            >
                                                {group.category === '3D' && (
                                                    <optgroup label="Volume (3D)">
                                                        {MODEL_OPTIONS['3D'].map(op => (
                                                            <option key={op.value} value={op.value}>{op.label}</option>
                                                        ))}
                                                    </optgroup>
                                                )}

                                                {group.category === '2D' && (
                                                    <optgroup label="Plate / Shell (2D)">
                                                        {MODEL_OPTIONS['2D'].map(op => (
                                                            <option key={op.value} value={op.value}>{op.label}</option>
                                                        ))}
                                                    </optgroup>
                                                )}

                                                {group.category === '1D' && (
                                                    <optgroup label="Beam / Truss (1D)">
                                                        {MODEL_OPTIONS['1D'].map(op => (
                                                            <option key={op.value} value={op.value}>{op.label}</option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="bg-slate-950 p-2 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between px-4">
                    <span>Detected Groups: {groups.length}</span>
                    <span>Selected: {groups.filter(g => g.selected).length}</span>
                </div>
            </div>
        </div>
    )
}
