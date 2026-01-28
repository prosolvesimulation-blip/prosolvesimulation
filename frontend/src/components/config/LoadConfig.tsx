import { useState, useEffect, useRef, useMemo } from 'react'
import {
    Trash2,
    Zap,
    Globe,
    Waves,
    TrendingUp,
    FileCode2,
    ChevronDown,
    ChevronUp,
    Copy,
    AlertCircle,
    AlertTriangle,
    Info,
    Sliders
} from 'lucide-react'
import { codeAsterIntelligence, type LoadParameters, type ValidationResult } from '../../lib/codeAsterIntelligence'

interface Load {
    id: string
    name: string
    type: 'gravity' | 'force' | 'pressure' | 'face_force'
    group?: string
    applyToWholeModel?: boolean
    fx?: string
    fy?: string
    fz?: string
    pressure?: string
    ax?: string
    ay?: string
    az?: string
    intensity?: string
    optionalParams?: Record<string, any>
}

interface LoadConfigProps {
    projectPath: string | null
    availableGroups?: string[]
    meshGroups?: any
    initialLoads?: any[]
    onUpdate?: (loads: any[]) => void
}

const LOAD_VARIANTS = {
    'gravity': { label: 'Grav_Acceleration', icon: Globe, color: 'text-orange-500', btn: 'bg-orange-600', unit: 'm/s²' },
    'force': { label: 'Nodal_Force', icon: Zap, color: 'text-emerald-500', btn: 'bg-emerald-600', unit: 'N' },
    'pressure': { label: 'Surface_Pressure', icon: Waves, color: 'text-cyan-500', btn: 'bg-cyan-600', unit: 'Pa' },
    'face_force': { label: 'Face_Force', icon: TrendingUp, color: 'text-purple-500', btn: 'bg-purple-600', unit: 'N/m²' }
}

// --- Advanced Parameters Component ---

interface AdvancedParamsProps {
    loadType: 'gravity' | 'force' | 'pressure' | 'face_force'
    params: Record<string, any>
    onChange: (key: string, value: any) => void
}

const AdvancedParams: React.FC<AdvancedParamsProps> = ({ loadType, params, onChange }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    
    // Map load types to Code_Aster types
    const loadTypeMap = {
        'gravity': 'PESANTEUR',
        'force': 'FORCE_NODALE',
        'pressure': 'PRES_REP',
        'face_force': 'FORCE_FACE'
    } as const
    
    const asterLoadType = loadTypeMap[loadType] as any
    const definition = codeAsterIntelligence.getLoadDefinition(asterLoadType)
    
    if (!definition?.optionalParams || definition.optionalParams.length === 0) {
        return null
    }
    
    const optionalParamDefs = [
        {
            asterKeyword: 'DOUBLE_LAGRANGE',
            label: 'Double Lagrange Method',
            type: 'toggle' as const,
            default: 'OUI',
            description: 'Utilise la méthode des doubles multiplicateurs de Lagrange. Valeur par défaut: OUI.',
            options: ['OUI', 'NON'],
            optionLabels: { 'OUI': 'Enabled', 'NON': 'Disabled' } as Record<string, string>
        },
        {
            asterKeyword: 'INFO',
            label: 'Information Level',
            type: 'select' as const,
            default: 1,
            description: 'Contrôle le niveau de verbosité des sorties du solveur. Valeur par défaut: 1.',
            options: [1, 2],
            optionLabels: { '1': 'Basic', '2': 'Detailed' } as Record<string, string>
        },
        {
            asterKeyword: 'VERI_NORM',
            label: 'Normal Verification',
            type: 'toggle' as const,
            default: 'OUI',
            description: 'Vérifie les vecteurs normaux pour les chargements surfaciques. Valeur par défaut: OUI.',
            options: ['OUI', 'NON'],
            optionLabels: { 'OUI': 'Enabled', 'NON': 'Disabled' } as Record<string, string>
        },
        {
            asterKeyword: 'VERI_AFFE',
            label: 'Assignment Verification',
            type: 'toggle' as const,
            default: 'OUI',
            description: 'Vérifie l\'affectation des chargements aux entités du maillage. Valeur par défaut: OUI.',
            options: ['OUI', 'NON'],
            optionLabels: { 'OUI': 'Enabled', 'NON': 'Disabled' } as Record<string, string>
        }
    ].filter(param => definition.optionalParams.includes(param.asterKeyword))
    
    return (
        <div className="mt-6">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-3 bg-slate-900/30 border border-slate-800 rounded-lg hover:bg-slate-900/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-slate-500" />
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        Advanced Parameters <span className="text-slate-600 font-normal normal-case ml-1">(Code_Aster)</span>
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            
            {isExpanded && (
                <div className="mt-3 p-4 bg-slate-900/30 border border-slate-800 rounded-lg space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        {optionalParamDefs.map((def) => {
                            const value = params[def.asterKeyword] ?? def.default
                            
                            return (
                                <div key={def.asterKeyword} className="space-y-2 group">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-300 font-bold">{def.label}</span>
                                            <code className="text-[8px] text-cyan-600 font-mono bg-cyan-950/20 px-1.5 py-0.5 rounded border border-cyan-900/20">
                                                {def.asterKeyword}
                                            </code>
                                        </div>
                                        <div className="relative group/tooltip">
                                            <Info size={10} className="text-slate-600 hover:text-cyan-400 cursor-help transition-colors" />
                                            <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-slate-900 text-slate-300 text-[10px] leading-relaxed rounded-xl shadow-2xl border border-slate-700 opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all z-50 translate-y-2 group-hover/tooltip:translate-y-0">
                                                <div className="font-bold text-white mb-1 border-b border-slate-800 pb-1">{def.asterKeyword}</div>
                                                {def.description}
                                                <div className="absolute bottom-[-4px] right-1 w-2 h-2 bg-slate-900 border-r border-b border-slate-700 rotate-45"></div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        {def.type === 'select' && (
                                            <div className="relative">
                                                <select
                                                    value={value}
                                                    onChange={(e) => onChange(def.asterKeyword, def.asterKeyword === 'INFO' ? parseInt(e.target.value) : e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-8 py-1.5 text-[10px] text-white focus:border-cyan-500 focus:bg-slate-800 outline-none font-mono appearance-none transition-all cursor-pointer hover:border-slate-600"
                                                >
                                                    {def.options?.map(opt => (
                                                        <option key={opt.toString()} value={opt.toString()}>
                                                            {def.optionLabels && def.optionLabels[opt.toString()] ? def.optionLabels[opt.toString()] : opt.toString()}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                            </div>
                                        )}
                                        
                                        {def.type === 'toggle' && (
                                            <button
                                                onClick={() => onChange(def.asterKeyword, value === 'OUI' ? 'NON' : 'OUI')}
                                                className={`
                                                    w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border
                                                    ${value === 'OUI' 
                                                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20' 
                                                        : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-400'
                                                    }
                                                `}
                                            >
                                                <span>{value === 'OUI' ? 'Enabled' : 'Disabled'}</span>
                                                <div className={`w-2 h-2 rounded-full ${value === 'OUI' ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'bg-slate-700'}`} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

export default function LoadConfig({
    projectPath,
    availableGroups = [],
    meshGroups,
    initialLoads = [],
    onUpdate
}: LoadConfigProps) {
    const [loads, setLoads] = useState<Load[]>([])
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
    const [isCodeOpen, setIsCodeOpen] = useState(true)
    const isFirstRender = useRef(true)
    const lastExportRef = useRef('')

    // Debug: Log availableGroups and meshGroups
    console.log('LoadConfig - availableGroups:', availableGroups)
    console.log('LoadConfig - meshGroups:', meshGroups)

    // Get group category from meshGroups data
    const getGroupCategory = (groupName: string): string => {
        console.log(`Getting category for group: ${groupName}`)
        console.log(`Available meshGroups:`, meshGroups)
        
        if (!meshGroups) {
            console.log('No meshGroups available, returning Unknown')
            return 'Unknown'
        }
        
        for (const [, groupsInFile] of Object.entries(meshGroups)) {
            const groups = groupsInFile as Record<string, any>
            const groupInfo = groups[groupName]
            console.log(`Looking for ${groupName} in groups:`, Object.keys(groups))
            
            if (groupInfo) {
                console.log(`Found group info for ${groupName}:`, groupInfo)
                
                // Use category if available, otherwise detect from types
                if (groupInfo.category) {
                    console.log(`Using predefined category: ${groupInfo.category}`)
                    return groupInfo.category
                }
                
                // Detect category from element types
                const types = groupInfo.types || {}
                const elementTypes = Object.keys(types)
                console.log(`Element types for ${groupName}:`, elementTypes)
                
                if (elementTypes.some(t => t.includes('HEXA') || t.includes('TETRA') || t.includes('PENTA'))) {
                    console.log(`Detected 3D category for ${groupName}`)
                    return '3D'
                }
                if (elementTypes.some(t => t.includes('QUAD') || t.includes('TRIA'))) {
                    console.log(`Detected 2D category for ${groupName}`)
                    return '2D'
                }
                if (elementTypes.some(t => t.includes('SEG'))) {
                    console.log(`Detected 1D category for ${groupName}`)
                    return '1D'
                }
                if (elementTypes.some(t => t === 'Node')) {
                    console.log(`Detected Node category for ${groupName}`)
                    return 'Node'
                }
            }
        }
        
        console.log(`Could not determine category for ${groupName}, returning Unknown`)
        return 'Unknown'
    }

    // Filter groups based on load type
    const getFilteredGroups = (loadType: 'gravity' | 'force' | 'pressure' | 'face_force'): string[] => {
        const filtered = availableGroups.filter(groupName => {
            // Exclude _FULL_MESH (various formats)
            if (groupName === '_FULL_MESH' || groupName === '_FULL_MESH_' || groupName.includes('FULL_MESH')) {
                console.log(`Excluding ${groupName} from ${loadType} loads`)
                return false
            }
            
            const category = getGroupCategory(groupName)
            console.log(`Group ${groupName} has category ${category} for ${loadType} load`)
            
            // For force loads: only nodal groups (Node only, not 1D)
            if (loadType === 'force') {
                const isValid = category === 'Node'
                console.log(`Force load: ${groupName} (${category}) -> ${isValid ? 'INCLUDED' : 'EXCLUDED'}`)
                return isValid
            }
            
            // For pressure loads: only surface groups (2D)
            if (loadType === 'pressure' || loadType === 'face_force') {
                const isValid = category === '2D'
                console.log(`${loadType} load: ${groupName} (${category}) -> ${isValid ? 'INCLUDED' : 'EXCLUDED'}`)
                return isValid
            }
            
            // For gravity loads: all groups except _FULL_MESH (already filtered above)
            console.log(`Gravity load: ${groupName} (${category}) -> INCLUDED`)
            return true
        })
        
        console.log(`Final filtered groups for ${loadType}:`, filtered)
        return filtered
    }

    // Persistence: Load from Props
    useEffect(() => {
        if (initialLoads.length > 0 && loads.length === 0) {
            const formatted = initialLoads.map((l, index) => {
                let type: 'gravity' | 'force' | 'pressure' | 'face_force' = 'force'
                if (l.type === 'PESANTEUR') type = 'gravity'
                else if (l.type === 'PRESSION') type = 'pressure'
                else if (l.type === 'FORCE_FACE') type = 'face_force'

                // Initialize default optional parameters for existing loads
                const loadTypeMap = {
                    'gravity': 'PESANTEUR',
                    'force': 'FORCE_NODALE',
                    'pressure': 'PRES_REP',
                    'face_force': 'FORCE_FACE'
                } as const
                
                const asterLoadType = loadTypeMap[type] as any
                const definition = codeAsterIntelligence.getLoadDefinition(asterLoadType)
                const defaultOptionalParams: Record<string, any> = {}
                
                if (definition?.optionalParams) {
                    definition.optionalParams.forEach(param => {
                        switch (param) {
                            case 'DOUBLE_LAGRANGE':
                                defaultOptionalParams[param] = 'OUI'
                                break
                            case 'INFO':
                                defaultOptionalParams[param] = 1
                                break
                            case 'VERI_NORM':
                                defaultOptionalParams[param] = 'OUI'
                                break
                            case 'VERI_AFFE':
                                defaultOptionalParams[param] = 'OUI'
                                break
                            default:
                                defaultOptionalParams[param] = null
                        }
                    })
                }

                return {
                    id: (index + 1).toString(),
                    name: l.name,
                    type: type,
                    group: l.group || '',
                    applyToWholeModel: l.applyToWholeModel !== undefined ? l.applyToWholeModel : true,
                    fx: l.fx?.toString() || '0',
                    fy: l.fy?.toString() || '0',
                    fz: l.fz?.toString() || '0',
                    pressure: l.pressure?.toString() || '0',
                    ax: l.direction?.[0]?.toString() || '0',
                    ay: l.direction?.[1]?.toString() || '0',
                    az: l.direction?.[2]?.toString() || '-1',
                    intensity: l.gravite?.toString() || '9.81',
                    optionalParams: defaultOptionalParams
                }
            })
            setLoads(formatted)
            if (formatted.length > 0) setSelectedIdx(0)
        }
    }, [initialLoads])

    // Sync to Parent
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        if (onUpdate) {
            const exportData = loads.map(l => {
                if (l.type === 'gravity') {
                    const result: any = {
                        name: String(l.name || ''),
                        type: 'PESANTEUR',
                        direction: [parseFloat(l.ax || '0'), parseFloat(l.ay || '0'), parseFloat(l.az || '-1')],
                        gravite: parseFloat(l.intensity || '9.81')
                    }
                    
                    // Only include group if not applying to whole model and group is selected
                    if (!l.applyToWholeModel && l.group) {
                        result.group = String(l.group)
                    }
                    
                    return result
                } else if (l.type === 'force') {
                    return {
                        name: String(l.name || ''),
                        type: 'FORCE_NODALE',
                        group: String(l.group || ''),
                        fx: parseFloat(l.fx || '0'),
                        fy: parseFloat(l.fy || '0'),
                        fz: parseFloat(l.fz || '0')
                    }
                } else if (l.type === 'face_force') {
                    return {
                        name: String(l.name || ''),
                        type: 'FORCE_FACE',
                        group: String(l.group || ''),
                        fx: parseFloat(l.fx || '0'),
                        fy: parseFloat(l.fy || '0'),
                        fz: parseFloat(l.fz || '0')
                    }
                } else {
                    return {
                        name: String(l.name || ''),
                        type: 'PRESSION',
                        group: String(l.group || ''),
                        pressure: parseFloat(l.pressure || '0')
                    }
                }
            })

            const currentString = JSON.stringify(exportData)
            if (lastExportRef.current !== currentString) {
                lastExportRef.current = currentString
                onUpdate(exportData)
            }
        }
    }, [loads, onUpdate])

    const addItem = (type: 'gravity' | 'force' | 'pressure' | 'face_force') => {
        const newId = (loads.length + 1).toString()
        const suffix = type === 'gravity' ? 'ACCEL' : type === 'force' ? 'LOAD' : type === 'face_force' ? 'FACE' : 'PRESS'
        
        // Get default optional parameters from Code_Aster intelligence
        const loadTypeMap = {
            'gravity': 'PESANTEUR',
            'force': 'FORCE_NODALE',
            'pressure': 'PRES_REP',
            'face_force': 'FORCE_FACE'
        } as const
        
        const asterLoadType = loadTypeMap[type] as any
        const definition = codeAsterIntelligence.getLoadDefinition(asterLoadType)
        const defaultOptionalParams: Record<string, any> = {}
        
        if (definition?.optionalParams) {
            definition.optionalParams.forEach(param => {
                switch (param) {
                    case 'DOUBLE_LAGRANGE':
                        defaultOptionalParams[param] = 'OUI'
                        break
                    case 'INFO':
                        defaultOptionalParams[param] = 1
                        break
                    case 'VERI_NORM':
                        defaultOptionalParams[param] = 'OUI'
                        break
                    case 'VERI_AFFE':
                        defaultOptionalParams[param] = 'OUI'
                        break
                    default:
                        defaultOptionalParams[param] = null
                }
            })
        }
        
        const newItem: Load = {
            id: newId,
            name: `${suffix}_${newId}`,
            type,
            group: getFilteredGroups(type)[0] || '',
            applyToWholeModel: type === 'gravity', // Default to whole model for gravity loads
            fx: '0', fy: '0', fz: '0', pressure: '0', ax: '0', ay: '0', az: '-1', intensity: '9.81',
            optionalParams: defaultOptionalParams
        }
        setLoads([...loads, newItem])
        setSelectedIdx(loads.length)
    }

    const removeItem = (id: string) => {
        const idx = loads.findIndex(l => l.id === id)
        setLoads(loads.filter(l => l.id !== id))
        if (selectedIdx === idx) setSelectedIdx(null)
    }

    const updateItem = (id: string, field: keyof Load, value: any) => {
        setLoads(loads.map(l => (l.id === id ? { ...l, [field]: value } : l)))
    }
    
    const updateOptionalParam = (id: string, param: string, value: any) => {
        console.log('Updating optional param:', { id, param, value })
        setLoads(loads.map(l => {
            if (l.id === id) {
                const updatedOptionalParams = { ...(l.optionalParams || {}), [param]: value }
                console.log('Updated optional params:', updatedOptionalParams)
                return { ...l, optionalParams: updatedOptionalParams }
            }
            return l
        }))
    }

    if (!projectPath) return <div className="p-10 text-center text-slate-500 font-mono italic uppercase tracking-widest">HALT: SESSION_ID_UNSET</div>

    const selected = selectedIdx !== null ? loads[selectedIdx] : null

    // Code_Aster Intelligence: Real-time Code Generation & Validation
    const generatedCode = useMemo(() => {
        if (!selected) return '# Select a load to preview Code_Aster command'
        
        const loadTypeMap = {
            'gravity': 'PESANTEUR',
            'force': 'FORCE_NODALE',
            'pressure': 'PRES_REP',
            'face_force': 'FORCE_FACE'
        } as const
        
        const asterLoadType = loadTypeMap[selected.type] as any
        if (!asterLoadType) return '# Unknown load type'
        
        // Convert UI values to Code_Aster parameters
        const parameters: LoadParameters = {}
        
        if (selected.type === 'gravity') {
            parameters.GRAVITE = parseFloat(selected.intensity || '9.81')
            parameters.DIRECTION = [
                parseFloat(selected.ax || '0'),
                parseFloat(selected.ay || '0'), 
                parseFloat(selected.az || '-1')
            ]
        } else if (selected.type === 'force') {
            const fx = parseFloat(selected.fx || '0')
            const fy = parseFloat(selected.fy || '0')
            const fz = parseFloat(selected.fz || '0')
            
            if (fx !== 0) parameters.FX = fx
            if (fy !== 0) parameters.FY = fy
            if (fz !== 0) parameters.FZ = fz
        } else if (selected.type === 'pressure') {
            parameters.PRES = parseFloat(selected.pressure || '0')
        } else if (selected.type === 'face_force') {
            const fx = parseFloat(selected.fx || '0')
            const fy = parseFloat(selected.fy || '0')
            const fz = parseFloat(selected.fz || '0')
            
            if (fx !== 0) parameters.FX = fx
            if (fy !== 0) parameters.FY = fy
            if (fz !== 0) parameters.FZ = fz
        }
        
        // Add optional parameters to the main parameters object
        const optionalParams = selected.optionalParams || {}
        console.log('Optional params in generatedCode:', optionalParams)
        if (optionalParams.DOUBLE_LAGRANGE) {
            parameters.DOUBLE_LAGRANGE = optionalParams.DOUBLE_LAGRANGE
        }
        if (optionalParams.INFO !== undefined && optionalParams.INFO !== null) {
            parameters.INFO = optionalParams.INFO
        }
        if (optionalParams.VERI_NORM) {
            parameters.VERI_NORM = optionalParams.VERI_NORM
        }
        if (optionalParams.VERI_AFFE) {
            parameters.VERI_AFFE = optionalParams.VERI_AFFE
        }
        
        console.log('Final parameters for generateCommandSyntax:', parameters)
        
        // Generate command using Code_Aster intelligence
        const result = codeAsterIntelligence.generateCommandSyntax(
            asterLoadType,
            parameters,
            selected.type === 'gravity' && selected.applyToWholeModel ? '' : (selected.group || ''),
            selected.name
        )
        
        if (result.status === 'error') {
            return `// Error: ${result.errors?.join(', ')}`
        }
        
        return result.command || '# Command generation failed'
    }, [selected])

    // Real-time validation using Code_Aster intelligence
    const validationResult = useMemo((): ValidationResult => {
        if (!selected) return { isValid: true, errors: [], warnings: [] }
        
        // Map UI load type to Code_Aster load type
        const loadTypeMap = {
            'gravity': 'PESANTEUR',
            'force': 'FORCE_NODALE',
            'pressure': 'PRES_REP',
            'face_force': 'FORCE_FACE'
        } as const
        
        const asterLoadType = loadTypeMap[selected.type] as any
        if (!asterLoadType) return { isValid: false, errors: ['Unknown load type'], warnings: [] }
        
        // Convert UI values to Code_Aster parameters
        const parameters: LoadParameters = {}
        
        if (selected.type === 'gravity') {
            parameters.GRAVITE = parseFloat(selected.intensity || '9.81')
            parameters.DIRECTION = [
                parseFloat(selected.ax || '0'),
                parseFloat(selected.ay || '0'),
                parseFloat(selected.az || '-1')
            ]
        } else if (selected.type === 'force') {
            const fx = parseFloat(selected.fx || '0')
            const fy = parseFloat(selected.fy || '0')
            const fz = parseFloat(selected.fz || '0')
            
            if (fx !== 0) parameters.FX = fx
            if (fy !== 0) parameters.FY = fy
            if (fz !== 0) parameters.FZ = fz
        } else if (selected.type === 'pressure') {
            parameters.PRES = parseFloat(selected.pressure || '0')
        } else if (selected.type === 'face_force') {
            const fx = parseFloat(selected.fx || '0')
            const fy = parseFloat(selected.fy || '0')
            const fz = parseFloat(selected.fz || '0')
            
            if (fx !== 0) parameters.FX = fx
            if (fy !== 0) parameters.FY = fy
            if (fz !== 0) parameters.FZ = fz
        }
        
        return codeAsterIntelligence.validateLoadParameters(asterLoadType, parameters)
    }, [selected])

    return (
        <div className="flex h-full w-full bg-slate-950 border border-slate-800 overflow-hidden font-sans">
            {/* Master: Load Inventory */}
            <div className="w-[300px] shrink-0 border-r border-slate-800 flex flex-col bg-slate-900/10">
                <div className="p-4 border-b border-slate-800 bg-slate-900/30">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Load_Register</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-600 bg-slate-950 px-1.5 border border-slate-800">{loads.length}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                        {Object.entries(LOAD_VARIANTS).map(([k, v]) => (
                            <button
                                key={k}
                                onClick={() => addItem(k as any)}
                                className={`flex flex-col items-center justify-center p-2 border border-slate-800 bg-slate-950 hover:bg-slate-900 transition-all group`}
                                title={`Add ${v.label}`}
                            >
                                <v.icon className={`w-3.5 h-3.5 ${v.color} mb-1 opacity-60 group-hover:opacity-100`} />
                                <span className="text-[7px] font-black text-slate-600 uppercase truncate w-full text-center group-hover:text-slate-400">{v.label.split('_')[0]}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {loads.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-8 opacity-20 grayscale">
                            <Zap className="w-10 h-10 mb-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-center">No_Loads_Simulated</span>
                        </div>
                    ) : (
                        loads.map((l, idx) => {
                            const isActive = selectedIdx === idx
                            const Variant = LOAD_VARIANTS[l.type]
                            return (
                                <div
                                    key={l.id}
                                    onClick={() => setSelectedIdx(idx)}
                                    className={`
                                        relative group p-4 mb-2 cursor-pointer border transition-all
                                        ${isActive ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-transparent border-transparent hover:bg-slate-800/40'}
                                    `}
                                >
                                    <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${isActive ? 'bg-emerald-500' : 'bg-transparent'}`} />
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-xs font-black truncate ${isActive ? 'text-white' : 'text-slate-400'}`}>{l.name}</span>
                                        <Variant.icon className={`w-3 h-3 ${Variant.color} opacity-40`} />
                                    </div>
                                    <div className="flex justify-between items-center text-[9px] font-mono text-slate-600 uppercase">
                                        <span className="truncate max-w-[150px]">
                                            {l.type === 'gravity' 
                                                ? (l.applyToWholeModel ? 'WHOLE_MODEL' : (l.group || 'NONE'))
                                                : (l.group || 'GLOBAL')
                                            }
                                        </span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeItem(l.id); }}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* Detail: Inspector */}
            <div className="flex-1 flex flex-col relative bg-slate-950 overflow-hidden">
                <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat" />

                {selected ? (
                    <>
                        {/* Detail Header */}
                        <div className="h-24 shrink-0 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/10">
                            <div className="flex items-center gap-6">
                                <div className={`p-4 border ${LOAD_VARIANTS[selected.type].color.replace('text', 'border')}/40 bg-slate-900`}>
                                    {(() => {
                                        const Icon = LOAD_VARIANTS[selected.type].icon
                                        return <Icon className={`w-6 h-6 ${LOAD_VARIANTS[selected.type].color}`} />
                                    })()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">External_Stimulus</span>
                                        <div className={`w-1.5 h-1.5 rounded-none animate-pulse outline outline-1 outline-offset-2 ${LOAD_VARIANTS[selected.type].btn.replace('bg-', 'bg-').replace('600', '500')} ${LOAD_VARIANTS[selected.type].btn.replace('bg-', 'outline-')}`} />
                                    </div>
                                    <input
                                        type="text"
                                        value={selected.name}
                                        onChange={(e) => updateItem(selected.id, 'name', e.target.value)}
                                        className="bg-transparent text-2xl font-black text-white leading-none font-mono focus:outline-none focus:border-b-2 border-emerald-500 w-full"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Inspector Body */}
                        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                            <div className="max-w-4xl mx-auto space-y-12">
                                {/* Parameters Console */}
                                <section>
                                    {selected.type === 'gravity' && (
                                        <div className="flex gap-8">
                                            {/* Input Region Column */}
                                            <div className="flex-1 space-y-6">
                                                <VectorInput
                                                    label="Acceleration_Intensity"
                                                    value={selected.intensity}
                                                    unit="m/s²"
                                                    onChange={(v) => updateItem(selected.id, 'intensity', v)}
                                                    theme="ORANGE"
                                                    fullWidth
                                                />
                                                <div className="grid grid-cols-3 gap-6">
                                                    {(['ax', 'ay', 'az'] as const).map(dir => (
                                                        <VectorInput
                                                            key={dir}
                                                            label={`Dir_${dir.slice(1).toUpperCase()}`}
                                                            value={selected[dir]}
                                                            unit="vec"
                                                            onChange={(v) => updateItem(selected.id, dir, v)}
                                                            theme="ORANGE"
                                                        />
                                                    ))}
                                                </div>
                                                
                                                {/* Advanced Parameters */}
                                                <AdvancedParams
                                                    loadType={selected.type}
                                                    params={selected.optionalParams || {}}
                                                    onChange={(param, value) => updateOptionalParam(selected.id, param, value)}
                                                />
                                                
                                                {/* Aster Command Preview */}
                                                <div className="border-t border-slate-800 mt-8">
                                                    <button 
                                                        onClick={() => setIsCodeOpen(!isCodeOpen)}
                                                        className="w-full flex items-center justify-between py-3 hover:bg-slate-900 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2 text-slate-400">
                                                            <FileCode2 className="w-4 h-4" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest">Aster Command Preview</span>
                                                        </div>
                                                        {isCodeOpen ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                                                    </button>
                                                    
                                                    {isCodeOpen && (
                                                        <div className="relative group">
                                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button 
                                                                    onClick={() => navigator.clipboard.writeText(generatedCode)}
                                                                    className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-white"
                                                                >
                                                                    <Copy className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                            <pre className="p-4 bg-slate-900 rounded-b border-x border-b border-slate-800 font-mono text-xs text-emerald-300 leading-relaxed overflow-x-auto">
                                                                {generatedCode}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Groups Sidebar Column */}
                                            <div className="w-48 shrink-0 bg-slate-900/30 border border-slate-800 rounded p-4">
                                                <span className="block text-[8px] font-black text-slate-600 uppercase tracking-widest mb-3">Application_Scope</span>
                                                
                                                {/* Whole Model Toggle */}
                                                <div className="mb-4">
                                                    <button
                                                        onClick={() => updateItem(selected.id, 'applyToWholeModel', true)}
                                                        className={`w-full px-3 py-2 text-[9px] font-mono border transition-all text-left mb-2 ${
                                                            selected.applyToWholeModel
                                                                ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'
                                                        }`}
                                                    >
                                                        Whole Model (Default)
                                                    </button>
                                                    <div className="text-[8px] text-slate-600 font-mono px-2">
                                                        Applies to entire model
                                                    </div>
                                                </div>
                                                
                                                {/* Group Selection */}
                                                <div>
                                                    <button
                                                        onClick={() => updateItem(selected.id, 'applyToWholeModel', false)}
                                                        className={`w-full px-3 py-2 text-[9px] font-mono border transition-all text-left mb-2 ${
                                                            !selected.applyToWholeModel
                                                                ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'
                                                        }`}
                                                    >
                                                        Specific Group
                                                    </button>
                                                    
                                                    {!selected.applyToWholeModel && (
                                                        <div className="space-y-1">
                                                            {getFilteredGroups('gravity').map(g => (
                                                                <button
                                                                    key={g}
                                                                    onClick={() => updateItem(selected.id, 'group', g)}
                                                                    className={`w-full px-3 py-2 text-[9px] font-mono border transition-all text-left ${
                                                                        selected.group === g
                                                                            ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                                                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'
                                                                    }`}
                                                                >
                                                                    {g}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {selected.type === 'force' && (
                                        <div className="flex gap-8">
                                            {/* Input Region Column */}
                                            <div className="flex-1">
                                                <div className="grid grid-cols-3 gap-6">
                                                    {(['fx', 'fy', 'fz'] as const).map(dir => (
                                                        <VectorInput
                                                            key={dir}
                                                            label={`Force_${dir.slice(-1).toUpperCase()}`}
                                                            value={selected[dir]}
                                                            unit="N"
                                                            onChange={(v) => updateItem(selected.id, dir, v)}
                                                            theme="EMERALD"
                                                        />
                                                    ))}
                                                </div>
                                                
                                                {/* Advanced Parameters */}
                                                <AdvancedParams
                                                    loadType={selected.type}
                                                    params={selected.optionalParams || {}}
                                                    onChange={(param, value) => updateOptionalParam(selected.id, param, value)}
                                                />
                                                
                                                {/* Aster Command Preview */}
                                                <div className="border-t border-slate-800 mt-8">
                                                    <button 
                                                        onClick={() => setIsCodeOpen(!isCodeOpen)}
                                                        className="w-full flex items-center justify-between py-3 hover:bg-slate-900 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2 text-slate-400">
                                                            <FileCode2 className="w-4 h-4" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest">Aster Command Preview</span>
                                                        </div>
                                                        {isCodeOpen ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                                                    </button>
                                                    
                                                    {isCodeOpen && (
                                                        <div className="relative group">
                                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button 
                                                                    onClick={() => navigator.clipboard.writeText(generatedCode)}
                                                                    className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-white"
                                                                >
                                                                    <Copy className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                            <pre className="p-4 bg-slate-900 rounded-b border-x border-b border-slate-800 font-mono text-xs text-emerald-300 leading-relaxed overflow-x-auto">
                                                                {generatedCode}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Groups Sidebar Column */}
                                            <div className="w-48 shrink-0 bg-slate-900/30 border border-slate-800 rounded p-4">
                                                <span className="block text-[8px] font-black text-slate-600 uppercase tracking-widest mb-3">Target_Boundary_Group</span>
                                                <div className="space-y-1">
                                                    {getFilteredGroups('force').map(g => (
                                                        <button
                                                            key={g}
                                                            onClick={() => updateItem(selected.id, 'group', g)}
                                                            className={`w-full px-3 py-2 text-[9px] font-mono border transition-all text-left ${
                                                                selected.group === g
                                                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                                                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'
                                                            }`}
                                                        >
                                                            {g}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {selected.type === 'pressure' && (
                                        <div className="flex gap-8">
                                            {/* Input Region Column */}
                                            <div className="flex-1">
                                                <div className="max-w-md">
                                                    <VectorInput
                                                        label="Surface_Pressure"
                                                        value={selected.pressure}
                                                        unit="Pa"
                                                        onChange={(v) => updateItem(selected.id, 'pressure', v)}
                                                        theme="CYAN"
                                                        fullWidth
                                                    />
                                                </div>
                                                
                                                {/* Advanced Parameters */}
                                                <AdvancedParams
                                                    loadType={selected.type}
                                                    params={selected.optionalParams || {}}
                                                    onChange={(param, value) => updateOptionalParam(selected.id, param, value)}
                                                />
                                                
                                                {/* Aster Command Preview */}
                                                <div className="border-t border-slate-800 mt-8">
                                                    <button 
                                                        onClick={() => setIsCodeOpen(!isCodeOpen)}
                                                        className="w-full flex items-center justify-between py-3 hover:bg-slate-900 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2 text-slate-400">
                                                            <FileCode2 className="w-4 h-4" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest">Aster Command Preview</span>
                                                        </div>
                                                        {isCodeOpen ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                                                    </button>
                                                    
                                                    {isCodeOpen && (
                                                        <div className="relative group">
                                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button 
                                                                    onClick={() => navigator.clipboard.writeText(generatedCode)}
                                                                    className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-white"
                                                                >
                                                                    <Copy className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                            <pre className="p-4 bg-slate-900 rounded-b border-x border-b border-slate-800 font-mono text-xs text-emerald-300 leading-relaxed overflow-x-auto">
                                                                {generatedCode}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Groups Sidebar Column */}
                                            <div className="w-48 shrink-0 bg-slate-900/30 border border-slate-800 rounded p-4">
                                                <span className="block text-[8px] font-black text-slate-600 uppercase tracking-widest mb-3">Target_Boundary_Group</span>
                                                <div className="space-y-1">
                                                    {getFilteredGroups('pressure').map(g => (
                                                        <button
                                                            key={g}
                                                            onClick={() => updateItem(selected.id, 'group', g)}
                                                            className={`w-full px-3 py-2 text-[9px] font-mono border transition-all text-left ${
                                                                selected.group === g
                                                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                                                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'
                                                            }`}
                                                        >
                                                            {g}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {selected.type === 'face_force' && (
                                        <div className="flex gap-8">
                                            {/* Input Region Column */}
                                            <div className="flex-1">
                                                <div className="grid grid-cols-3 gap-6">
                                                    {(['fx', 'fy', 'fz'] as const).map(dir => (
                                                        <VectorInput
                                                            key={dir}
                                                            label={`Force_${dir.slice(-1).toUpperCase()}`}
                                                            value={selected[dir]}
                                                            unit="N/m²"
                                                            onChange={(v) => updateItem(selected.id, dir, v)}
                                                            theme="PURPLE"
                                                        />
                                                    ))}
                                                </div>
                                                
                                                {/* Advanced Parameters */}
                                                <AdvancedParams
                                                    loadType={selected.type}
                                                    params={selected.optionalParams || {}}
                                                    onChange={(param, value) => updateOptionalParam(selected.id, param, value)}
                                                />
                                                
                                                {/* Aster Command Preview */}
                                                <div className="border-t border-slate-800 mt-8">
                                                    <button 
                                                        onClick={() => setIsCodeOpen(!isCodeOpen)}
                                                        className="w-full flex items-center justify-between py-3 hover:bg-slate-900 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2 text-slate-400">
                                                            <FileCode2 className="w-4 h-4" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest">Aster Command Preview</span>
                                                        </div>
                                                        {isCodeOpen ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                                                    </button>
                                                    
                                                    {isCodeOpen && (
                                                        <div className="relative group">
                                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button 
                                                                    onClick={() => navigator.clipboard.writeText(generatedCode)}
                                                                    className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-white"
                                                                >
                                                                    <Copy className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                            <pre className="p-4 bg-slate-900 rounded-b border-x border-b border-slate-800 font-mono text-xs text-emerald-300 leading-relaxed overflow-x-auto">
                                                                {generatedCode}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Groups Sidebar Column */}
                                            <div className="w-48 shrink-0 bg-slate-900/30 border border-slate-800 rounded p-4">
                                                <span className="block text-[8px] font-black text-slate-600 uppercase tracking-widest mb-3">Target_Surface_Group</span>
                                                <div className="space-y-1">
                                                    {getFilteredGroups('face_force').map(g => (
                                                        <button
                                                            key={g}
                                                            onClick={() => updateItem(selected.id, 'group', g)}
                                                            className={`w-full px-3 py-2 text-[9px] font-mono border transition-all text-left ${
                                                                selected.group === g
                                                                    ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                                                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'
                                                            }`}
                                                        >
                                                            {g}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </section>


                                {/* VALIDATION FEEDBACK */}
                                {validationResult && (validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
                                    <div className="space-y-2">
                                        {validationResult.errors.length > 0 && (
                                            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded text-red-200">
                                                <AlertCircle className="w-5 h-5 shrink-0" />
                                                <div className="text-xs">
                                                    <strong className="block uppercase mb-1">Validation Errors</strong>
                                                    {validationResult.errors.map((error, idx) => (
                                                        <div key={idx} className="mt-1">• {error}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {validationResult.warnings.length > 0 && (
                                            <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-200">
                                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                                <div className="text-xs">
                                                    <strong className="block uppercase mb-1">Warnings</strong>
                                                    {validationResult.warnings.map((warning, idx) => (
                                                        <div key={idx} className="mt-1">• {warning}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}



                                {!selected.group && selected.type !== 'gravity' && (
                                    <div className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded text-orange-200">
                                        <AlertTriangle className="w-5 h-5 shrink-0" />
                                        <div className="text-xs">
                                            <strong className="block uppercase mb-1">Missing Target</strong>
                                            This load requires a target group to be valid. Please select a group from the top right menu.
                                        </div>
                                    </div>
                                )}
                                
                                {!selected.applyToWholeModel && !selected.group && selected.type === 'gravity' && (
                                    <div className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded text-orange-200">
                                        <AlertTriangle className="w-5 h-5 shrink-0" />
                                        <div className="text-xs">
                                            <strong className="block uppercase mb-1">Missing Target Group</strong>
                                            When applying acceleration to a specific group, you must select a target group from the Application_Scope menu.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-20 filter grayscale">
                        <Zap className="w-16 h-16 text-slate-500 mb-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">select_thermal_force_policy</span>
                    </div>
                )}
            </div>
        </div>
    )
}

function VectorInput({ label, value, unit, onChange, theme, fullWidth }: { label: string, value: any, unit: string, onChange: (v: string) => void, theme?: 'EMERALD' | 'ORANGE' | 'CYAN' | 'PURPLE', fullWidth?: boolean }) {
    const colorClass = theme === 'ORANGE' ? 'text-orange-500' : theme === 'CYAN' ? 'text-cyan-400' : theme === 'PURPLE' ? 'text-purple-400' : 'text-emerald-400'
    const borderClass = theme === 'ORANGE' ? 'border-orange-500/30' : theme === 'CYAN' ? 'border-cyan-500/30' : theme === 'PURPLE' ? 'border-purple-500/30' : 'border-emerald-500/30'

    return (
        <div className={`group relative bg-slate-950/50 border border-slate-800 p-3 transition-all hover:bg-slate-900 ${fullWidth ? 'w-full' : ''}`}>
            <label className="block text-[9px] font-black text-slate-600 uppercase mb-2 tracking-tighter">
                {label}
            </label>
            <div className="flex items-baseline gap-4">
                <input
                    type="text"
                    value={value || '0'}
                    onChange={(e) => onChange(e.target.value)}
                    className={`w-full bg-transparent text-xl font-black ${colorClass} font-mono focus:outline-none`}
                />
                <span className="text-[10px] font-black text-slate-700 tracking-widest">{unit}</span>
            </div>
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${borderClass} bg-current opacity-0 group-hover:opacity-100 transition-opacity`} />
        </div>
    )
}
