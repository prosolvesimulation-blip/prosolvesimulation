import { useState, useEffect, useMemo } from 'react'
import {
    Ruler,
    Layers,
    Calculator,
    AlertCircle,
    Settings2,
    Compass,
    Target,
    Maximize2,
    Database,
    ChevronDown,
    ChevronUp,
    Copy,
    CheckCircle,
    Eye
} from 'lucide-react'
import { geometryIntelligence } from '../../lib/codeAster/builders/geometryIntelligence'

interface GeometryConfigProps {
    projectPath: string | null
    meshGroups?: any
    availableGeometries?: any[]
    onUpdate?: (geometries: any[]) => void
    onGeometryCommandsUpdate?: (commands: any) => void
}

const PROFILE_TYPES = {
    'RECTANGLE': { label: 'Solid Rectangle', default: { hy: 100, hz: 50, offset_y: 0, offset_z: 0, rotation: 0, fiber_y: 0, fiber_z: 0 } },
    'BOX': { label: 'Rectangular Tube', default: { hy: 100, hz: 50, t: 5, offset_y: 0, offset_z: 0, rotation: 0, fiber_y: 0, fiber_z: 0 } },
    'CIRCLE': { label: 'Solid Circle', default: { r: 50, offset_y: 0, offset_z: 0, rotation: 0, fiber_y: 0, fiber_z: 0 } },
    'TUBE': { label: 'Circular Tube', default: { r: 50, t: 5, offset_y: 0, offset_z: 0, rotation: 0, fiber_y: 0, fiber_z: 0 } },
    'I_SECTION': { label: 'I-Section', default: { h: 200, tw: 6.3, bf_top: 100, tf_top: 8, bf_bot: 100, tf_bot: 8, offset_y: 0, offset_z: 0, rotation: 0, fiber_y: 0, fiber_z: 0 } }
}

const SHELL_DEFAULT = { thickness: 10.0, offset: 0.0, vx: 1.0, vy: 0.0, vz: 0.0 }

export default function GeometryConfig({ projectPath, availableGeometries = [], onUpdate, onGeometryCommandsUpdate }: GeometryConfigProps) {
    const [geometries, setGeometries] = useState<any[]>([])
    const [selectedIdx, setSelectedIdx] = useState(0)
    const [sectionImage, setSectionImage] = useState<string | null>(null)
    const [calculatedProps, setCalculatedProps] = useState<any>(null)
    const [calcLoading, setCalcLoading] = useState(false)
    const [calcError, setCalcError] = useState<string | null>(null)
    const [inspectorTab, setInspectorTab] = useState<'DIM' | 'PROP'>('DIM')
    
    // Code_Aster preview state
    const [showPreview, setShowPreview] = useState(false)
    const [copySuccess, setCopySuccess] = useState(false)

    const selected = geometries[selectedIdx] || null

    // Track when availableGeometries prop changes
    useEffect(() => {
        console.log('🔄 [PROP] availableGeometries prop updated:', {
            count: availableGeometries.length,
            geometries: availableGeometries.map(g => ({
                group: g.group,
                category: g._category,
                sectionParams: g.section_params,
                sectionProperties: g.section_properties,
                hasSectionParams: !!g.section_params,
                hasSectionProperties: !!g.section_properties,
                paramsCount: g.section_params ? Object.keys(g.section_params).length : 0,
                propsCount: g.section_properties ? Object.keys(g.section_properties).length : 0
            }))
        })
    }, [availableGeometries])

    // Generate Code_Aster commands for each ready group individually
    const geometryCommands = useMemo(() => {
        console.log('🔍 [GEOMETRY] Checking .comm generation for individual groups...')
        console.log('📊 [GEOMETRY] Available geometries:', availableGeometries.map(g => ({
            group: g.group,
            category: g._category,
            hasParams: !!g.section_params,
            hasProps: !!g.section_properties,
            shellThickness: g._category === '2D' ? g.section_params?.thickness : 'N/A',
            beamInertias: g._category === '1D' ? {
                area: g.section_properties?.["Area (A)"],
                iy: g.section_properties?.["Iyy (Node 0,0)"],
                iz: g.section_properties?.["Izz (Node 0,0)"]
            } : 'N/A'
        })))
        
        // Filter geometries that are ready for command generation
        const readyGeometries = availableGeometries.filter(g => {
            if (g._category === '2D') {
                // Shells: Need section_params (thickness, etc.)
                const isReady = g.section_params && Object.keys(g.section_params).length > 0
                console.log(`🔸 [SHELL] ${g.group}: ready = ${isReady} (has params: ${!!g.section_params})`)
                return isReady
            } else if (g._category === '1D') {
                // Beams: Need section_properties (calculated inertias)
                const isReady = g.section_properties && Object.keys(g.section_properties).length > 0
                console.log(`🔸 [BEAM] ${g.group}: ready = ${isReady} (has props: ${!!g.section_properties})`)
                return isReady
            }
            return false
        })
        
        console.log(`✅ [GEOMETRY] Ready groups: ${readyGeometries.length}/${availableGeometries.length}`)
        console.log('📝 [GEOMETRY] Ready geometries:', readyGeometries.map(g => g.group))
        
        if (readyGeometries.length === 0) {
            console.log('⏳ [GEOMETRY] No groups ready, waiting...')
            return {
                modeleCommands: [],
                caraCommands: [],
                validation: { isValid: false, errors: [], warnings: [] },
                summary: { totalGeometries: availableGeometries.length, beams: 0, shells: 0, hasSectionProperties: false, missingProperties: [] }
            }
        }
        
        console.log('✅ [GEOMETRY] Generating .comm commands for ready groups')
        const commands = geometryIntelligence.generateGeometryCommands(readyGeometries)
        console.log('📝 [GEOMETRY] Generated commands:', commands.summary)
        return commands
    }, [availableGeometries])

    // Update global state when geometry commands change
    useEffect(() => {
        if (onGeometryCommandsUpdate && geometryCommands) {
            onGeometryCommandsUpdate(geometryCommands)
        }
    }, [geometryCommands, onGeometryCommandsUpdate])

    // Load geometries
    useEffect(() => {
        if (availableGeometries.length > 0 && geometries.length === 0) {
            const initialized = availableGeometries
                .filter((g: any) => {
                    const cat = g._category || ''
                    return cat === '1D' || cat === '2D'
                })
                .map((g: any) => {
                    const isBeam = g._category === '1D'
                    const isShell = g._category === '2D'
                    
                    // Preserve original category from ModelConfig
                    const originalCategory = g.section_type || (isBeam ? 'BEAM' : isShell ? 'SHELL' : 'UNKNOWN')

                    // Determine profile type for calculation
                    let profileType = g.profile_type
                    if (!profileType) {
                        if (isBeam) {
                            profileType = 'I_SECTION'  // Default for beams
                        } else if (isShell) {
                            profileType = 'SHELL'      // Only option for shells
                        }
                    }

                    // Set default parameters based on profile type
                    let params = {}
                    if (isBeam && profileType in PROFILE_TYPES) {
                        params = { ...PROFILE_TYPES[profileType as keyof typeof PROFILE_TYPES].default, ...(g.section_params || {}) }
                    } else if (isShell) {
                        params = { ...SHELL_DEFAULT, ...(g.section_params || {}) }
                    }

                    return {
                        ...g,
                        section_type: originalCategory,      // Keep original category ('BEAM', 'SHELL')
                        profile_type: profileType,           // Profile for calculation ('I_SECTION', 'SHELL')
                        profile_name: g.profile_name || PROFILE_TYPES[profileType as keyof typeof PROFILE_TYPES]?.label || 'Custom',
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

    // Sync selection state
    useEffect(() => {
        if (geometries[selectedIdx]) {
            setSectionImage(geometries[selectedIdx].section_image || null)
            setCalculatedProps(geometries[selectedIdx].section_properties || null)
        }
    }, [selectedIdx, geometries])

    const calculateSection = async () => {
        if (!selected) return
        const isBeam = selected._category === '1D'

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
                    type: selected.profile_type,  // Send profile type for calculation
                    params: selected.section_params
                })
            })

            const data = await response.json()

            if (data.status === 'success') {
                console.log('🧮 [GEOMETRY] Section calculation completed for:', selected.group)
                setSectionImage(data.image)
                setCalculatedProps(data.properties)

                const updatedGeometries = geometries.map((g, i) =>
                    i === selectedIdx ? {
                        ...g,
                        section_properties: data.properties,
                        section_mesh: data.mesh,
                        section_image: data.image
                    } : g
                )
                
                console.log('🔄 [GEOMETRY] Updating global state with section properties')
                console.log('📤 [GLOBAL] Sending to global state:', updatedGeometries.map(g => ({
                    group: g.group,
                    category: g._category,
                    hasSectionProps: !!g.section_properties,
                    propsCount: g.section_properties ? Object.keys(g.section_properties).length : 0,
                    propsSample: g.section_properties ? {
                        area: g.section_properties["Area (A)"],
                        iy: g.section_properties["Iyy (Node 0,0)"],
                        iz: g.section_properties["Izz (Node 0,0)"]
                    } : null
                })))
                
                // Update local state
                setGeometries(updatedGeometries)
                
                // Update global state through callback
                if (onUpdate) {
                    console.log('📞 [CALLBACK] Calling onUpdate callback...')
                    onUpdate(updatedGeometries)
                    console.log('✅ [CALLBACK] onUpdate callback completed')
                } else {
                    console.log('❌ [CALLBACK] onUpdate callback is null/undefined')
                }
            } else {
                throw new Error(data.message)
            }
        } catch (err: any) {
            setCalcError(`Critical: ${err.message}`)
        } finally {
            setCalcLoading(false)
        }
    }

    const handleParamEdit = (idx: number, key: string, value: string) => {
        console.log('✏️ [EDIT] Editing parameter:', { idx, key, value, group: geometries[idx]?.group })
        
        const updatedGeometries = geometries.map((g, i) =>
            i === idx ? { ...g, profile_name: 'Custom', section_params: { ...g.section_params, [key]: value } } : g
        )
        
        console.log('📤 [EDIT] Updated geometries for global state:', updatedGeometries.map(g => ({
            group: g.group,
            category: g._category,
            sectionParams: g.section_params
        })))
        
        setGeometries(updatedGeometries)
        
        // Update global state through callback
        if (onUpdate) {
            console.log('📞 [EDIT] Calling onUpdate callback for parameter edit...')
            onUpdate(updatedGeometries)
            console.log('✅ [EDIT] Parameter edit callback completed')
        } else {
            console.log('❌ [EDIT] onUpdate callback is null/undefined during parameter edit')
        }
    }

    const handleSectionTypeChange = (idx: number, profileType: string) => {
        const updatedGeometries = geometries.map((g, i) =>
            i === idx ? { 
                ...g, 
                profile_type: profileType,  // Update profile type for calculation
                profile_name: PROFILE_TYPES[profileType as keyof typeof PROFILE_TYPES]?.label || 'Custom',
                section_params: { ...(PROFILE_TYPES as any)[profileType].default } 
            } : g
        )
        setGeometries(updatedGeometries)
        
        // Update global state through callback
        if (onUpdate) {
            onUpdate(updatedGeometries)
        }
    }

    if (!projectPath) return <div className="p-10 text-center text-slate-500 font-mono italic">SESSION_HALTED: PROJECT_ID_NULL</div>

    if (geometries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-20 bg-slate-950 border border-slate-800">
                <Ruler className="w-16 h-16 text-slate-800 mb-6" />
                <h3 className="text-xl font-black text-slate-500 uppercase tracking-widest">Dimension_Inventory_Empty</h3>
                <p className="mt-4 text-xs font-mono text-slate-600 max-w-sm text-center">No active 1D (Beam) or 2D (Shell) groups detected. Configure cross-sections in the Model panel first.</p>
            </div>
        )
    }

    const isBeam = selected?._category === '1D'
    const isShell = selected?._category === '2D'

    return (
        <div className="flex h-full w-full bg-slate-950 text-slate-200 border border-slate-800 overflow-y-auto font-sans">
            {/* Sidebar: Group Inventory */}
            <div className="w-64 shrink-0 border-r border-slate-800 flex flex-col bg-slate-900/10">
                <div className="p-4 border-b border-slate-800 bg-slate-900/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-orange-500" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Inventory</span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-600 bg-slate-950 px-1.5 border border-slate-800">{geometries.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {geometries.map((geo, idx) => {
                        const isActive = selectedIdx === idx
                        return (
                            <div
                                key={idx}
                                onClick={() => setSelectedIdx(idx)}
                                className={`
                                    relative flex flex-col p-3 mb-1 cursor-pointer border transition-all
                                    ${isActive
                                        ? 'bg-orange-500/5 border-orange-500/30'
                                        : 'bg-transparent border-transparent hover:bg-slate-800/30'}
                                `}
                            >
                                <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${isActive ? (geo._category === '1D' ? 'bg-orange-500' : 'bg-cyan-500') : 'bg-transparent'}`} />
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`text-xs font-black truncate pr-2 ${isActive ? 'text-white' : 'text-slate-400'}`}>{geo.group}</span>
                                    <span className={`text-[8px] font-bold px-1 border ${geo._category === '1D' ? 'text-orange-500 border-orange-500/30 bg-orange-500/10' : 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10'}`}>
                                        {geo._category}
                                    </span>
                                </div>
                                <span className="text-[9px] font-mono text-slate-600 uppercase truncate">{geo.section_type || 'unassigned'}</span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Inspector + Viewport */}
            <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative">
                <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat" />

                {/* Header */}
                <div className="h-20 shrink-0 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/10">
                    <div className="flex items-center gap-6">
                        <div className={`p-4 border ${selected._category === '1D' ? 'text-orange-500 border-orange-500/30' : 'text-cyan-400 border-cyan-400/30'}`}>
                            {selected._category === '1D' ? <Compass className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Resource_Integration</span>
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                            </div>
                            <h3 className="text-xl font-black text-white leading-none font-mono">
                                {selected.group}
                            </h3>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        {isBeam && (
                            <button
                                onClick={calculateSection}
                                disabled={calcLoading}
                                className={`
                                    flex items-center gap-2 px-6 py-2 border font-black text-xs uppercase tracking-widest transition-all
                                    ${calcLoading
                                        ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                                        : 'bg-orange-500 border-orange-400 text-slate-950 hover:bg-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.15)]'}
                                `}
                            >
                                <Calculator className="w-4 h-4" />
                                {calcLoading ? 'Analyzing...' : 'Execute Calculation'}
                            </button>
                        )}
                        <div className="h-10 w-[1px] bg-slate-800 mx-2" />
                        <div className="flex bg-slate-900 border border-slate-800 p-0.5">
                            <button
                                onClick={() => setInspectorTab('DIM')}
                                className={`px-4 py-1.5 text-[10px] font-black uppercase transition-all ${inspectorTab === 'DIM' ? 'bg-slate-800 text-white shadow-xl' : 'text-slate-600 hover:text-slate-400'}`}
                            >
                                Dimensions
                            </button>
                            <button
                                onClick={() => setInspectorTab('PROP')}
                                className={`px-4 py-1.5 text-[10px] font-black uppercase transition-all ${inspectorTab === 'PROP' ? 'bg-slate-800 text-white shadow-xl' : 'text-slate-600 hover:text-slate-400'}`}
                            >
                                Datasheet
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content Split */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Input Panel */}
                    <div className="w-[380px] shrink-0 border-r border-slate-800 flex flex-col bg-slate-900/5">
                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                            {inspectorTab === 'DIM' ? (
                                <div className="space-y-6">
                                    {/* Section Type Selector */}
                                    <section>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Database className="w-3.5 h-3.5 text-orange-500" />
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Structural_Topology</h4>
                                        </div>
                                        <div className="bg-slate-950/50 border border-slate-800 p-1">
                                            <select
                                                className="w-full bg-transparent text-xs font-bold text-white p-2.5 focus:outline-none border-l-2 border-orange-500 hover:bg-slate-900 transition-all cursor-pointer"
                                                value={selected.profile_type || 'I_SECTION'}
                                                onChange={(e) => handleSectionTypeChange(selectedIdx, e.target.value)}
                                                disabled={!isBeam}
                                            >
                                                {isBeam ? (
                                                    Object.entries(PROFILE_TYPES).map(([k, v]) => (
                                                        <option key={k} value={k} className="bg-slate-950">{v.label}</option>
                                                    ))
                                                ) : (
                                                    <option value="SHELL">Shell Plate Formulation</option>
                                                )}
                                            </select>
                                        </div>
                                    </section>

                                    {/* Parameters Grid */}
                                    <section>
                                        <div className="flex items-center gap-2 mb-4">
                                            <Settings2 className="w-3.5 h-3.5 text-slate-500" />
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mathematical_Parameters</h4>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            {Object.entries(selected.section_params || {}).map(([k, v]: [string, any]) => {
                                                const isOffset = k.includes('offset') || k === 'rotation'
                                                const isFiber = k.includes('fiber')

                                                let variant = 'NORMAL'
                                                if (isOffset) variant = 'POSITION'
                                                if (isFiber) variant = 'FIBER'

                                                const labelMap: Record<string, string> = {
                                                    'hy': 'Height_Y', 'hz': 'Width_Z', 't': 'Thick', 'r': 'Radius',
                                                    'h': 'Height', 'tw': 'Web_T', 'bf_top': 'TF_Width', 'tf_top': 'TF_Thick',
                                                    'bf_bot': 'BF_Width', 'tf_bot': 'BF_Thick', 'rotation': 'Rotation_Θ',
                                                    'offset_y': 'Shift_Y', 'offset_z': 'Shift_Z', 'fiber_y': 'Fiber_Y', 'fiber_z': 'Fiber_Z',
                                                    'thickness': 'Thickness_T', 'offset': 'Shift_N', 'vx': 'Dir_X', 'vy': 'Dir_Y', 'vz': 'Dir_Z'
                                                }

                                                return (
                                                    <div key={k} className="group relative bg-slate-950/50 border border-slate-800 p-2.5 transition-all hover:bg-slate-900">
                                                        <label className="block text-[8px] font-black text-slate-500 uppercase mb-1 tracking-tighter">
                                                            {labelMap[k] || k}
                                                        </label>
                                                        <div className="flex items-baseline gap-2">
                                                            <input
                                                                type="text"
                                                                value={v || '0'}
                                                                onChange={(e) => handleParamEdit(selectedIdx, k, e.target.value)}
                                                                className={`w-full bg-transparent text-base font-black text-white font-mono focus:outline-none ${variant === 'POSITION' ? 'text-cyan-400' : variant === 'FIBER' ? 'text-emerald-400' : 'text-slate-100'}`}
                                                            />
                                                            <span className="text-[8px] font-bold text-slate-700">{isOffset && k !== 'rotation' ? 'MM' : k === 'rotation' ? 'DEG' : isShell ? 'MM' : 'MM'}</span>
                                                        </div>
                                                        <div className={`absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                                                            <div className={`w-1 h-1 rounded-full ${variant === 'POSITION' ? 'bg-cyan-500' : variant === 'FIBER' ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </section>

                                    <div className="p-4 bg-orange-500/5 border border-orange-500/20">
                                        <div className="flex gap-3">
                                            <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                                            <p className="text-[10px] text-orange-400 italic font-mono leading-relaxed">
                                                All dimensions are strictly in [mm] for calculation, but converted to [M] for solver integration. Offset applies from the mesh node.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                                        <Database className="w-5 h-5 text-emerald-400" />
                                        <div>
                                            <h4 className="text-sm font-black text-white uppercase italic">Section_Datasheet</h4>
                                            <p className="text-[10px] text-slate-600 font-mono">Real-time evaluated mechanical properties</p>
                                        </div>
                                    </div>

                                    {!calculatedProps ? (
                                        <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
                                            <Calculator className="w-12 h-12 text-slate-600" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.4em]">awaiting_calculation</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-6 mt-4">
                                            <PropGroup title="Geometric_Domain" pairs={[
                                                ['Area (A)', calculatedProps["Area (A)"], 'mm²'],
                                                ['Centroid Y', calculatedProps["Centroid Y (cy)"], 'mm'],
                                                ['Centroid Z', calculatedProps["Centroid Z (cx)"], 'mm']
                                            ]} />

                                            <PropGroup title="Principal_Inertia" theme="CYAN" pairs={[
                                                ['Iyy (Local)', calculatedProps["Iyy (Local)"], 'mm⁴'],
                                                ['Izz (Local)', calculatedProps["Izz (Local)"], 'mm⁴'],
                                                ['Principal Angle', calculatedProps["Angle (deg)"], 'deg'],
                                                ['Principal I1', calculatedProps["I1 (Principal)"], 'mm⁴'],
                                                ['Principal I2', calculatedProps["I2 (Principal)"], 'mm⁴']
                                            ]} />

                                            <PropGroup title="Solver_Nodal_Data" theme="ORANGE" pairs={[
                                                ['Iyy (Origin)', calculatedProps["Iyy (Node 0,0)"], 'mm⁴', true],
                                                ['Izz (Origin)', calculatedProps["Izz (Node 0,0)"], 'mm⁴', true],
                                                ['Iyz (Origin)', calculatedProps["Iyz (Node 0,0)"], 'mm⁴'],
                                                ['Torsional J', calculatedProps["Torsion J"], 'mm⁴', true]
                                            ]} />

                                            <PropGroup title="Resistance_Indicators" pairs={[
                                                ['Shear Area Ay', calculatedProps["Shear Area Ay"], 'mm²'],
                                                ['Shear Area Az', calculatedProps["Shear Area Az"], 'mm²'],
                                                ['Elastic Mod. Wy', calculatedProps["Elastic Mod. Wy (Zxx)"], 'mm³'],
                                                ['Elastic Mod. Wz', calculatedProps["Elastic Mod. Wz (Zyy)"], 'mm³']
                                            ]} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Viewport: Schematic Visualizer */}
                    <div className="flex-1 flex flex-col bg-[#020617] relative overflow-hidden">
                        {/* Technical Grid Overlay */}
                        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                        <div className="absolute inset-4 border border-slate-900 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,1)]" />

                        <div className="h-10 shrink-0 border-b border-white/5 flex items-center justify-between px-6 bg-black/40 z-10">
                            <div className="flex items-center gap-3">
                                <Target className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Blueprint_Visualizer</span>
                            </div>
                            {isBeam && (
                                <div className="flex items-center gap-4 text-[9px] font-mono text-slate-500">
                                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 border border-slate-600" /> PROFILE</div>
                                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-orange-500" /> NODES</div>
                                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-cyan-500" /> NEUTRAL_AXIS</div>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 relative overflow-hidden flex items-center justify-center p-8 z-10">
                            {calcLoading ? (
                                <div className="flex flex-col items-center gap-4 text-orange-500">
                                    <Calculator className="w-12 h-12 animate-spin-slow" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">Running_Numeric_Analysis</span>
                                </div>
                            ) : calcError ? (
                                <div className="text-red-500 font-mono text-[10px] p-8 border border-red-500/20 bg-red-500/5 max-w-sm">
                                    <div className="flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4" /> ENGINE_FAILURE_ABORT</div>
                                    {calcError}
                                </div>
                            ) : sectionImage ? (
                                <div className="relative group/view flex items-center justify-center w-full h-full">
                                    <img
                                        src={sectionImage}
                                        alt="Section Blueprint"
                                        className="max-w-full max-h-full object-contain filter invert opacity-90 transition-all group-hover:opacity-100"
                                        style={{ imageRendering: 'auto' }}
                                    />
                                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover/view:opacity-100 transition-opacity">
                                        <span className="text-[9px] font-mono text-emerald-500/50 uppercase">Analysis: Convergence_Success</span>
                                    </div>
                                </div>
                            ) : isBeam ? (
                                <div className="flex flex-col items-center text-slate-800">
                                    <Ruler className="w-24 h-24 mb-6 opacity-10" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-20">Awaiting_Command: Calculate</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center text-cyan-900">
                                    <Maximize2 className="w-24 h-24 mb-6 opacity-20" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 text-cyan-800">3D_Shell_Active</span>
                                    <p className="mt-2 text-[9px] font-mono text-cyan-900 uppercase">Geometrically defined by mesh normals and thickness</p>
                                </div>
                            )}
                        </div>

                        {/* Viewport Info Overlay */}
                        <div className="h-8 px-6 bg-black/80 flex items-center justify-between text-[8px] font-mono text-slate-700 uppercase z-10">
                            <div className="flex gap-4">
                                <span>Render: Schematics v.1.2</span>
                                <span>Engine: Python_Section_Calc</span>
                            </div>
                            <span>Z-Axis Normal | Auto-Scale Active</span>
                        </div>
                    </div>
                </div>

                {/* Code_Aster Preview Panel - Moved inside main content */}
                <div className="border-t border-slate-800 bg-slate-950">
                    <div className="p-4">
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors mb-4"
                        >
                            <Eye className="w-3 h-3" />
                            Code_Aster Element Characteristics Preview
                            {showPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {showPreview && (
                            <div className="space-y-4">
                                {/* Synchronization Status */}
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${geometryCommands.validation.isValid ? 'bg-green-500' : calcLoading ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
                                    <span className="text-[9px] font-mono text-slate-600">
                                        {!geometryCommands.validation.isValid ? (
                                            calcLoading ? 'Calculating section properties...' : 'Waiting for element characteristics data...'
                                        ) : `Ready (${geometryCommands.summary.beams + geometryCommands.summary.shells} groups)`}
                                    </span>
                                </div>

                                {/* Validation Status */}
                                {geometryCommands.validation.errors.length > 0 && (
                                    <div className="border border-red-500/20 bg-red-500/5 p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertCircle className="w-3 h-3 text-red-500" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-red-500">Validation Errors</span>
                                        </div>
                                        {geometryCommands.validation.errors.map((error, idx) => (
                                            <div key={idx} className="text-[9px] font-mono text-red-400">{error}</div>
                                        ))}
                                    </div>
                                )}

                                {geometryCommands.validation.warnings.length > 0 && (
                                    <div className="border border-yellow-500/20 bg-yellow-500/5 p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertCircle className="w-3 h-3 text-yellow-500" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-yellow-500">Warnings</span>
                                        </div>
                                        {geometryCommands.validation.warnings.map((warning, idx) => (
                                            <div key={idx} className="text-[9px] font-mono text-yellow-400">{warning}</div>
                                        ))}
                                    </div>
                                )}

                                {/* Element Characteristics Display */}
                                {geometryCommands.validation.isValid && (
                                    <div className="space-y-3">
                                        {/* Summary */}
                                        <div className="grid grid-cols-5 gap-4 text-[9px] font-mono text-slate-600 border border-slate-800 p-3">
                                            <div>
                                                <div className="text-slate-500">Total</div>
                                                <div className="text-slate-300">{geometryCommands.summary.totalGeometries}</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500">Beams</div>
                                                <div className="text-slate-300">{geometryCommands.summary.beams}</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500">Shells</div>
                                                <div className="text-slate-300">{geometryCommands.summary.shells}</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500">Properties</div>
                                                <div className={geometryCommands.summary.hasSectionProperties ? 'text-green-500' : 'text-red-500'}>
                                                    {geometryCommands.summary.hasSectionProperties ? 'Complete' : 'Missing'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500">Status</div>
                                                <div className="text-green-500">Ready</div>
                                            </div>
                                        </div>

                                        {/* Code Display */}
                                        <div className="relative">
                                            <div className="absolute top-2 right-2 z-10">
                                                <button
                                                    onClick={() => {
                                                        const fullCommand = [...geometryCommands.modeleCommands, ...geometryCommands.caraCommands].join('\n')
                                                        navigator.clipboard.writeText(fullCommand)
                                                        setCopySuccess(true)
                                                        setTimeout(() => setCopySuccess(false), 2000)
                                                    }}
                                                    className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[8px] font-mono text-slate-400 transition-colors"
                                                    disabled={!geometryCommands.validation.isValid}
                                                >
                                                    {copySuccess ? (
                                                        <>
                                                            <CheckCircle className="w-3 h-3 text-green-500" />
                                                            Copied
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-3 h-3" />
                                                            Copy
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                            <pre className="bg-black/50 border border-slate-800 p-4 text-[9px] font-mono text-slate-400 overflow-x-auto">
                                                {[...geometryCommands.modeleCommands, ...geometryCommands.caraCommands].join('\n')}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

const PropGroup = ({ title, pairs, theme }: { title: string, pairs: any[], theme?: 'CYAN' | 'ORANGE' }) => {
    return (
        <div className="space-y-2">
            <h5 className={`text-[9px] font-black uppercase tracking-widest ${theme === 'CYAN' ? 'text-cyan-500' : theme === 'ORANGE' ? 'text-orange-500' : 'text-slate-500'}`}>
                {title}
            </h5>
            <div className="grid grid-cols-1 gap-1.5">
                {pairs.map(([l, v, u, bold]: any) => (
                    <div key={l} className={`flex items-center justify-between px-3 py-1.5 bg-slate-950/80 border ${bold ? 'border-emerald-500/20' : 'border-slate-800'}`}>
                        <div className="flex items-center gap-2">
                            <div className={`w-1 h-1 ${bold ? 'bg-emerald-500 animate-pulse' : 'bg-slate-800'}`} />
                            <span className="text-[8px] font-bold text-slate-600 uppercase tracking-tight">{l}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black font-mono ${bold ? (theme === 'ORANGE' ? 'text-orange-400' : 'text-white') : 'text-slate-100'}`}>
                                {formatVal(v)}
                            </span>
                            <span className="text-[8px] font-mono text-slate-600 w-8">{u}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

const formatVal = (v: any) => {
    if (v === undefined || v === null) return 'N/A'
    const n = typeof v === 'string' ? parseFloat(v) : v
    if (isNaN(n)) return v
    if (Math.abs(n) < 1e-9) return '0.00'
    if (Math.abs(n) < 1e-3 || Math.abs(n) > 1e6) return n.toExponential(4)
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
