import { useState, useEffect, useRef, useCallback } from 'react'

interface GeometryConfigProps {
    projectPath: string | null
    meshGroups?: any
    availableGeometries?: any[]
    onUpdate?: (geometries: any[]) => void
}

const PROFILE_TYPES = {
    'RECTANGLE': { label: 'Solid Rectangle', default: { hy: 100, hz: 50, offset_y: 0, offset_z: 0, rotation: 0 } },
    'BOX': { label: 'Rectangular Tube', default: { hy: 100, hz: 50, t: 5, offset_y: 0, offset_z: 0, rotation: 0 } },
    'CIRCLE': { label: 'Solid Circle', default: { r: 50, offset_y: 0, offset_z: 0, rotation: 0 } },
    'TUBE': { label: 'Circular Tube', default: { r: 50, t: 5, offset_y: 0, offset_z: 0, rotation: 0 } },
    'I_SECTION': { label: 'I-Section', default: { h: 200, tw: 6.3, bf_top: 100, tf_top: 8, bf_bot: 100, tf_bot: 8, offset_y: 0, offset_z: 0, rotation: 0 } }
}

const SHELL_DEFAULT = { thickness: 10.0, offset: 0.0, vx: 1.0, vy: 0.0, vz: 0.0 }

export default function GeometryConfig({ projectPath, availableGeometries = [], onUpdate }: GeometryConfigProps) {
    const [geometries, setGeometries] = useState<any[]>([])
    const [selectedIdx, setSelectedIdx] = useState(0)
    const [sectionImage, setSectionImage] = useState<string | null>(null)
    const [calculatedProps, setCalculatedProps] = useState<any>(null)
    const [calcLoading, setCalcLoading] = useState(false)
    const [calcError, setCalcError] = useState<string | null>(null)

    const [splitRatio, setSplitRatio] = useState(55)

    const containerRef = useRef<HTMLDivElement>(null)
    const isResizing = useRef(false)


    // Load geometries from parent
    useEffect(() => {
        // Only initialize if we haven't loaded anything yet, OR if the upstream count is different 
        // (rudimentary check to allow initial load but prevent looop)
        if (availableGeometries.length > 0 && geometries.length === 0) {
            const initialized = availableGeometries
                .filter((g: any) => {
                    const cat = g._category || ''
                    return cat === '1D' || cat === '2D'
                })
                .map((g: any) => {
                    const isBeam = g._category === '1D'
                    const isShell = g._category === '2D'

                    let params = {}
                    if (isBeam) {
                        params = { ...PROFILE_TYPES['I_SECTION'].default, ...(g.section_params || {}) }
                    } else if (isShell) {
                        params = { ...SHELL_DEFAULT, ...(g.section_params || {}) }
                    }

                    return {
                        ...g,
                        section_type: g.section_type || (isBeam ? 'I_SECTION' : 'SHELL'),
                        profile_name: g.profile_name || 'Custom',
                        section_params: params
                    }
                })

            setGeometries(initialized)
        }
    }, [availableGeometries])

    // Sync to parent
    useEffect(() => {
        if (geometries.length > 0 && onUpdate) {
            onUpdate(geometries)
        }
    }, [geometries, onUpdate])

    // Sync local calculation state when selection changes
    useEffect(() => {
        if (geometries[selectedIdx]) {
            setSectionImage(geometries[selectedIdx].section_image || null)
            setCalculatedProps(geometries[selectedIdx].section_properties || null)
        }
    }, [selectedIdx, geometries])

    // Calculate section
    const calculateSection = async () => {
        if (geometries.length === 0) return
        const selected = geometries[selectedIdx]
        const isBeam = selected.type?.includes('POU') || selected.type?.includes('BARRE')

        if (!isBeam) {
            setSectionImage(null)
            setCalculatedProps(null)
            return
        }

        setCalcLoading(true)
        setCalcError(null)

        try {
            const response = await fetch('/api/calculate_section', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: selected.section_type,
                    params: selected.section_params
                })
            })

            const data = await response.json()

            if (data.status === 'success') {
                setSectionImage(data.image)
                setCalculatedProps(data.properties)

                // SAVE RESULT TO GEOMETRIES STATE (Persistence)
                setGeometries(prev => prev.map((g, i) =>
                    i === selectedIdx ? {
                        ...g,
                        section_properties: data.properties,
                        section_mesh: data.mesh,
                        section_image: data.image
                    } : g
                ))
            } else {
                throw new Error(data.message)
            }
        } catch (err: any) {
            setCalcError(`Error: ${err.message}`)
        } finally {
            setCalcLoading(false)
        }
    }

    // Auto trigger


    // Handlers
    const handleParamEdit = (idx: number, key: string, value: string) => {
        setGeometries(prev => prev.map((g, i) =>
            i === idx ? { ...g, profile_name: 'Custom', section_params: { ...g.section_params, [key]: value } } : g
        ))
    }

    const handleSectionTypeChange = (idx: number, type: string) => {
        setGeometries(prev => prev.map((g, i) =>
            i === idx ? { ...g, section_type: type, profile_name: 'Custom', section_params: { ...(PROFILE_TYPES as any)[type].default } } : g
        ))
    }

    // Resizer
    const handleMouseDown = () => {
        isResizing.current = true
        document.body.style.cursor = 'col-resize'
    }

    const handleMouseUp = () => {
        isResizing.current = false
        document.body.style.cursor = ''
    }

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing.current || !containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        let w = ((e.clientX - rect.left) / rect.width) * 100
        if (w < 30) w = 30
        if (w > 70) w = 70
        setSplitRatio(w)
    }, [])

    // TAB-LEAVE TRIGGER: Pre-calculate extrusion when leaving tab
    useEffect(() => {
        return () => {
            const hasShells = geometries.some(g => {
                const isShell = g.type?.includes('DKT') || g.type?.includes('DST') || g.type?.includes('COQUE')
                const thickness = parseFloat(g.section_params?.thickness || '0')
                return isShell && thickness > 0
            })

            if (hasShells && projectPath) {
                console.log("GEOMETRY_CHILD: Leaving tab. Triggering MEDCoupling extrusion pre-calculation...");
                // Trigger warm-up request (VTK converter will call med_extruder.py)
                fetch('/api/get_mesh_vtk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        folder_path: projectPath,
                        geometries: geometries
                    })
                }).catch(err => console.error("Extrusion pre-calc failed", err))
            }
        }
    }, [projectPath, geometries]) // Captured state at time of unmount or change

    useEffect(() => {
        window.addEventListener('mouseup', handleMouseUp)
        window.addEventListener('mousemove', handleMouseMove)
        return () => {
            window.removeEventListener('mouseup', handleMouseUp)
            window.removeEventListener('mousemove', handleMouseMove)
        }
    }, [handleMouseMove])

    if (!projectPath) {
        return <div className="p-10 text-center text-slate-500">Please select a project.</div>
    }

    if (geometries.length === 0) {
        return (
            <div className="p-10 text-center text-slate-500">
                No 1D/2D groups found. Please configure Model first.
            </div>
        )
    }

    const selected = geometries[selectedIdx] || geometries[0]
    const isBeam = selected._category === '1D'
    const isShell = selected._category === '2D'

    return (
        <div className="flex h-full w-full bg-slate-950 text-slate-200 text-sm overflow-hidden">
            {/* Sidebar */}
            <div className="w-56 border-r border-slate-800 bg-slate-950 flex flex-col shrink-0">
                <div className="h-10 border-b border-slate-800 flex items-center px-4 bg-slate-950 shrink-0">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mesh Groups</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {geometries.map((geo, idx) => (
                        <div
                            key={idx}
                            onClick={() => setSelectedIdx(idx)}
                            className={`px-4 py-3 border-b border-slate-800/50 cursor-pointer flex justify-between items-center transition-colors ${selectedIdx === idx ? 'bg-blue-600/10 border-l-2 border-l-blue-500 text-white' : 'hover:bg-slate-900 text-slate-400 border-l-2 border-l-transparent'
                                }`}
                        >
                            <span className="text-xs font-medium truncate w-28" title={geo.group}>{geo.group}</span>
                            <span className="text-[9px] font-mono text-slate-500">{geo.type}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Split Area */}
            <div className="flex-1 flex overflow-hidden relative" ref={containerRef}>
                {/* Input Panel */}
                <div style={{ width: `${splitRatio}%` }} className="flex flex-col border-r border-slate-800 bg-slate-900 h-full min-w-[350px]">
                    <div className="h-12 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900 shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Definition</span>
                            <span className="text-[10px] text-slate-500 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700 ml-2">
                                {selected.group}
                            </span>
                        </div>
                        {isBeam && (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={calculateSection}
                                    disabled={calcLoading}
                                    className={`px-2 py-1 rounded text-[9px] font-bold uppercase border transition-all bg-blue-600 hover:bg-blue-500 text-white border-blue-500 ${calcLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {calcLoading ? 'PROCESSING...' : 'CALCULATE'}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* BEAM CONFIG */}
                        {isBeam && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-blue-400 uppercase mb-1.5 block">Profile Type</label>
                                        <select
                                            className="w-full bg-slate-950 border border-slate-700 text-xs rounded p-2.5 outline-none focus:border-blue-500"
                                            value={selected.section_type || 'I_SECTION'}
                                            onChange={(e) => handleSectionTypeChange(selectedIdx, e.target.value)}
                                        >
                                            {Object.entries(PROFILE_TYPES).map(([k, v]) => (
                                                <option key={k} value={k}>{v.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block border-b border-slate-800 pb-1">
                                        Dimensions & Position (mm / deg)
                                    </label>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                        {Object.entries(selected.section_params || {}).map(([k, v]: [string, any]) => {
                                            const isOffset = k.includes('offset')
                                            const isRotation = k === 'rotation'

                                            let badgeClass = 'bg-slate-800 border-slate-700 text-slate-400'
                                            let inputClass = 'border-slate-700 focus:border-blue-500'
                                            let labelText = k

                                            if (isOffset) {
                                                badgeClass = 'bg-purple-900/30 border-purple-800 text-purple-400'
                                                inputClass = 'border-purple-800 focus:border-purple-500'
                                                labelText = k.replace('offset_', 'off_')
                                            } else if (isRotation) {
                                                badgeClass = 'bg-orange-900/30 border-orange-800 text-orange-400'
                                                inputClass = 'border-orange-800 focus:border-orange-500'
                                                labelText = 'rot°'
                                            }

                                            return (
                                                <div key={k} className="relative">
                                                    <div className={`absolute inset-y-0 left-0 w-16 rounded-l border-y border-l flex items-center justify-center text-[9px] font-bold uppercase ${badgeClass}`}>
                                                        {labelText}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        className={`w-full bg-slate-900 border text-white text-sm rounded pl-20 pr-2 py-1.5 outline-none font-mono transition-all ${inputClass}`}
                                                        value={v || ''}
                                                        onChange={(e) => handleParamEdit(selectedIdx, k, e.target.value)}
                                                    />
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Properties Table - SIMPLIFIED */}
                                {calculatedProps && (
                                    <div className="mt-8 pt-4 border-t border-slate-800">
                                        <div className="text-[10px] font-bold text-green-500 uppercase mb-3">✓ Calculated Properties</div>
                                        <div className="space-y-4 text-xs">
                                            {/* Geometric Center & Area */}
                                            <div>
                                                <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Geometric</div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <PropRow label="Area (A)" value={calculatedProps["Area (A)"]} />
                                                    <PropRow label="Centroid Y" value={calculatedProps["Centroid Y (cy)"]} />
                                                    <PropRow label="Centroid Z" value={calculatedProps["Centroid Z (cx)"]} />
                                                </div>
                                            </div>

                                            {/* Principal Inertias */}
                                            <div>
                                                <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Principal (Local)</div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <PropRow label="Iyy (Local)" value={calculatedProps["Iyy (Local)"]} />
                                                    <PropRow label="Izz (Local)" value={calculatedProps["Izz (Local)"]} />
                                                    <PropRow label="Angle (deg)" value={calculatedProps["Angle (deg)"]} />
                                                    <PropRow label="I1 (Principal)" value={calculatedProps["I1 (Principal)"]} />
                                                    <PropRow label="I2 (Principal)" value={calculatedProps["I2 (Principal)"]} />
                                                </div>
                                            </div>

                                            {/* Nodal Inertias (The ones that matter for Aster if offset) */}
                                            <div>
                                                <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Nodal (At 0,0)</div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <PropRow label="Iyy (Node)" value={calculatedProps["Iyy (Node 0,0)"]} highlight />
                                                    <PropRow label="Izz (Node)" value={calculatedProps["Izz (Node 0,0)"]} highlight />
                                                    <PropRow label="Iyz (Node)" value={calculatedProps["Iyz (Node 0,0)"]} />
                                                    <PropRow label="Torsion J" value={calculatedProps["Torsion J"]} highlight />
                                                    <PropRow label="Warping Iw" value={calculatedProps["Warping Iw"]} />
                                                </div>
                                            </div>

                                            {/* Mechanical */}
                                            <div>
                                                <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Mechanical</div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <PropRow label="Shear Ay" value={calculatedProps["Shear Area Ay"]} />
                                                    <PropRow label="Shear Az" value={calculatedProps["Shear Area Az"]} />
                                                    <PropRow label="Elast. Wy" value={calculatedProps["Elastic Mod. Wy (Zxx)"]} />
                                                    <PropRow label="Elast. Wz" value={calculatedProps["Elastic Mod. Wz (Zyy)"]} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* SHELL CONFIG */}
                        {isShell && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 w-24 rounded-l border-y border-l bg-slate-800 border-slate-700 text-slate-400 flex items-center justify-center text-[9px] font-bold uppercase">
                                            Thickness
                                        </div>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 text-sm rounded pl-28 pr-2 py-1.5 outline-none font-mono"
                                            value={selected.section_params?.thickness || 0}
                                            onChange={(e) => handleParamEdit(selectedIdx, 'thickness', e.target.value)}
                                        />
                                    </div>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 w-24 rounded-l border-y border-l bg-slate-800 border-slate-700 text-slate-400 flex items-center justify-center text-[9px] font-bold uppercase">
                                            Eccentricity
                                        </div>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 text-sm rounded pl-28 pr-2 py-1.5 outline-none font-mono"
                                            value={selected.section_params?.offset || 0}
                                            onChange={(e) => handleParamEdit(selectedIdx, 'offset', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block border-b border-slate-800 pb-1">
                                        Normal Vector
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['vx', 'vy', 'vz'].map((axis) => (
                                            <div key={axis} className="relative">
                                                <div className="absolute inset-y-0 left-0 w-8 rounded-l border-y border-l bg-slate-800 border-slate-700 text-slate-400 flex items-center justify-center text-[9px] font-bold uppercase">
                                                    {axis.toUpperCase()}
                                                </div>
                                                <input
                                                    type="text"
                                                    className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 text-sm rounded pl-10 pr-2 py-1.5 outline-none font-mono"
                                                    value={selected.section_params?.[axis] || 0}
                                                    onChange={(e) => handleParamEdit(selectedIdx, axis, e.target.value)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Resizer */}
                <div
                    className="w-1 bg-slate-950 hover:bg-blue-600 cursor-col-resize z-20"
                    onMouseDown={handleMouseDown}
                />

                {/* Preview */}
                <div className="flex-1 flex flex-col bg-white relative min-w-[200px]">
                    <div className="h-12 border-b border-slate-200 flex items-center px-4 bg-slate-50 shrink-0">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Section Preview</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        {calcLoading ? (
                            <div className="text-blue-500 animate-pulse">Processing...</div>
                        ) : calcError ? (
                            <div className="text-red-500 text-xs p-4">{calcError}</div>
                        ) : sectionImage ? (
                            <img src={sectionImage} alt="Section" className="max-w-full max-h-full object-contain" />
                        ) : isBeam ? (
                            <div className="text-slate-300 text-center">
                                <span className="text-5xl opacity-20">📐</span>
                                <p className="text-xs mt-2">No Geometry</p>
                            </div>
                        ) : (
                            <div className="text-slate-300 text-center">
                                <span className="text-5xl opacity-20">⬡</span>
                                <p className="text-xs mt-2">3D Shell Element</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

const PropRow = ({ label, value, highlight }: { label: string, value: any, highlight?: boolean }) => {
    const formatVal = (v: any) => {
        if (v === undefined || v === null) return '-'
        if (typeof v !== 'number') return v
        if (Math.abs(v) < 1e-9) return '0.00'
        if (Math.abs(v) < 1e-3 || Math.abs(v) > 1e5) return v.toExponential(3)
        return v.toFixed(2)
    }

    return (
        <div className={`flex justify-between px-2 py-1 rounded border ${highlight ? 'bg-purple-900/20 border-purple-500/30' : 'bg-slate-950/50 border-slate-800'}`}>
            <span className="text-[9px] text-slate-500">{label}</span>
            <span className={`text-[10px] font-mono ${highlight ? 'text-white font-bold' : 'text-blue-300'}`}>
                {formatVal(value)}
            </span>
        </div>
    )
}
