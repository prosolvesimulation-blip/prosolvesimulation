import { useState, useMemo, useEffect } from 'react'
import {
    Trash2, Shield, AlertTriangle,
    Box, Layers, Minus,
    Move3d, ArrowUpFromLine, Maximize2, FileCode2, Copy,
    AlertCircle, ChevronDown, ChevronUp, Anchor, MousePointer2
} from 'lucide-react'

// --- 1. Tipos e Interfaces ---

type ConstraintType = 'DDL_IMPO' | 'FACE_IMPO' | 'ARETE_IMPO' | 'PRE_EPSI';
type MeshTopology = 'NODE' | 'WIRE' | 'SURFACE' | 'VOLUME' | 'COMPOUND' | 'UNKNOWN';


export interface GroupMetadata {
    name: string
    topology: MeshTopology
    count: number
}

interface RestrictionConfigProps {
    projectPath?: string | null
    // Aceita qualquer formato vindo do pai, tentaremos normalizar internamente
    availableGroups?: string[]
    meshGroups?: any // NEW: DNA da malha
    initialRestrictions?: any[]
    onUpdate?: (data: any) => void
    onRestrictionCommandsUpdate?: (commands: any) => void
}

interface KinematicConstraint {
    id: string
    name: string
    type: ConstraintType
    targetGroup: string

    // DOFs
    dof_trans: { x: boolean; y: boolean; z: boolean }
    dof_rot: { x: boolean; y: boolean; z: boolean }
    values: Record<string, string | number>

    // Específicos
    dnor: boolean
    dtan: boolean
    strain_tensor: {
        epxx: number; epyy: number; epzz: number;
        epxy: number; epxz: number; epsyz: number;
    }
}

// --- 2. Definições ---

const CONSTRAINT_DEFS = {
    'DDL_IMPO': {
        label: 'Nodal Constraint',
        description: 'Standard Dirichlet condition.',
        allowedTopology: ['NODE'],
        icon: Move3d,
        color: 'text-blue-400',
        bg: 'bg-blue-400/10'
    },
    'FACE_IMPO': {
        label: 'Face Constraint',
        description: 'Constraint on surface elements.',
        allowedTopology: ['SURFACE'],
        icon: Layers,
        color: 'text-purple-400',
        bg: 'bg-purple-400/10'
    },
    'ARETE_IMPO': {
        label: 'Edge Constraint',
        description: 'Constraint on line elements.',
        allowedTopology: ['WIRE'],
        icon: Minus,
        color: 'text-emerald-400',
        bg: 'bg-emerald-400/10'
    },
    'PRE_EPSI': {
        label: 'Pre-Strain',
        description: 'Imposed initial strain field.',
        allowedTopology: ['SURFACE', 'VOLUME'],
        icon: Maximize2,
        color: 'text-amber-400',
        bg: 'bg-amber-400/10'
    }
}

// --- Componente Principal ---

export default function RestrictionConfig({
    projectPath,
    availableGroups = [],
    meshGroups = {}, // NEW
    initialRestrictions = [],
    onUpdate,
    onRestrictionCommandsUpdate
}: RestrictionConfigProps) {

    const [constraints, setConstraints] = useState<KinematicConstraint[]>(initialRestrictions)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [isCodeOpen, setIsCodeOpen] = useState(true)

    // Initialize with initialRestrictions when it changes
    useEffect(() => {
        if (initialRestrictions && initialRestrictions.length > 0) {
            setConstraints(initialRestrictions)
        }
    }, [initialRestrictions])

    // --- ADAPTER LAYER: Normalização Inteligente de Grupos ---
    const normalizedGroups: GroupMetadata[] = useMemo(() => {
        // Priority A: Use meshGroups metadata (DNA)
        if (meshGroups && Object.keys(meshGroups).length > 0) {
            const results: GroupMetadata[] = [];

            Object.values(meshGroups).forEach((fileData: any) => {
                const groups = fileData.groups || {};
                Object.entries(groups).forEach(([gName, gInfo]: [string, any]) => {
                    if (gName === '_FULL_MESH_') return;

                    let topo: MeshTopology = 'UNKNOWN';
                    const category = gInfo.category;

                    if (category === 'Node') topo = 'NODE';
                    else if (category === '1D') topo = 'WIRE';
                    else if (category === '2D') topo = 'SURFACE';
                    else if (category === '3D') topo = 'VOLUME';

                    // Fallback to detection if category is missing
                    if (topo === 'UNKNOWN') {
                        const dim = gInfo.dimension ?? gInfo.dim;
                        if (dim === 0) topo = 'NODE';
                        else if (dim === 1) topo = 'WIRE';
                        else if (dim === 2) topo = 'SURFACE';
                        else if (dim === 3) topo = 'VOLUME';
                    }

                    results.push({
                        name: gName,
                        topology: topo,
                        count: gInfo.count || 0
                    });
                });
            });

            if (results.length > 0) return results;
        }

        // Priority B: Fallback to availableGroups (string array)
        if (!availableGroups || availableGroups.length === 0) return [];

        return availableGroups.map((g: any) => {
            const name = typeof g === 'string' ? g : g.name || 'Unnamed';
            return {
                name,
                topology: inferTopologyFromName(name),
                count: 0
            };
        });
    }, [meshGroups, availableGroups]);

    // Função auxiliar para inferência por nome (Fallback)
    function inferTopologyFromName(name: string): MeshTopology {
        const lower = name.toLowerCase();
        if (lower.includes('vol') || lower.includes('solid')) return 'VOLUME';
        if (lower.includes('face') || lower.includes('surf') || lower.includes('2d')) return 'SURFACE';
        if (lower.includes('line') || lower.includes('wire') || lower.includes('edge') || lower.includes('1d')) return 'WIRE';
        if (lower.includes('no') || lower.includes('point') || lower.includes('0d')) return 'NODE';
        return 'UNKNOWN';
    }

    // Derived State
    const selected = useMemo(() => constraints.find(c => c.id === selectedId), [constraints, selectedId])

    const compatibleGroups = useMemo(() => {
        if (!selected) return []
        const definition = CONSTRAINT_DEFS[selected.type]
        return normalizedGroups.filter(g => definition.allowedTopology.includes(g.topology))
    }, [selected, normalizedGroups])

    // Physics Intelligence
    const physicsCheck = useMemo(() => {
        if (!selected) return { rotAllowed: true, warning: null }

        const groupMeta = normalizedGroups.find(g => g.name === selected.targetGroup)
        if (!groupMeta) return { rotAllowed: true, warning: null }

        if (selected.type === 'DDL_IMPO' && groupMeta.topology === 'VOLUME') {
            return {
                rotAllowed: false,
                warning: 'Volume elements (3D) do not support Rotational DOFs. Rotations auto-disabled.'
            }
        }
        return { rotAllowed: true, warning: null }
    }, [selected, normalizedGroups])

    // Code Gen Preview
    const generatedCode = useMemo(() => {
        if (!selected) return '# Select a constraint'
        const args: string[] = []

        if (selected.type === 'PRE_EPSI') {
            Object.entries(selected.strain_tensor).forEach(([k, v]) => {
                if (v !== 0) args.push(`${k.toUpperCase()}=${v}`)
            })
        } else {
            if (selected.dof_trans.x) args.push(`DX=${selected.values['DX'] || 0}`)
            if (selected.dof_trans.y) args.push(`DY=${selected.values['DY'] || 0}`)
            if (selected.dof_trans.z) args.push(`DZ=${selected.values['DZ'] || 0}`)

            if (physicsCheck.rotAllowed) {
                if (selected.dof_rot.x) args.push(`DRX=${selected.values['DRX'] || 0}`)
                if (selected.dof_rot.y) args.push(`DRY=${selected.values['DRY'] || 0}`)
                if (selected.dof_rot.z) args.push(`DRZ=${selected.values['DRZ'] || 0}`)
            }

            if (selected.type === 'FACE_IMPO' && selected.dnor) args.push(`DNOR=${selected.values['DNOR'] || 0}`)
            if (selected.type === 'ARETE_IMPO' && selected.dtan) args.push(`DTAN=${selected.values['DTAN'] || 0}`)
        }

        if (args.length === 0) return '# No active values'

        // Determine Group Type (MA vs NO)
        const groupMeta = normalizedGroups.find(g => g.name === selected.targetGroup)
        const groupKey = (groupMeta?.topology === 'NODE' || selected.targetGroup.toUpperCase().includes('NODE'))
            ? 'GROUP_NO'
            : 'GROUP_MA'

        const keyword = selected.type

        return `${selected.name} = AFFE_CHAR_MECA(
    MODELE = MODELE,
    ${keyword} = _F(
        ${groupKey} = '${selected.targetGroup}',
        ${args.join(',\n        ')}
    ),
);`
    }, [selected, physicsCheck, normalizedGroups])

    // Propagate changes
    useEffect(() => {
        if (onUpdate) onUpdate(constraints);
    }, [constraints, onUpdate]);

    // Generate and update restriction commands
    useEffect(() => {
        if (onRestrictionCommandsUpdate) {
            const generateCommand = (c: KinematicConstraint) => {
                const args: string[] = []

                // DOF Translation
                if (c.dof_trans.x) args.push(`DX=${c.values['DX'] || 0}`)
                if (c.dof_trans.y) args.push(`DY=${c.values['DY'] || 0}`)
                if (c.dof_trans.z) args.push(`DZ=${c.values['DZ'] || 0}`)

                // DOF Rotation
                if (physicsCheck.rotAllowed) {
                    if (c.dof_rot.x) args.push(`DRX=${c.values['DRX'] || 0}`)
                    if (c.dof_rot.y) args.push(`DRY=${c.values['DRY'] || 0}`)
                    if (c.dof_rot.z) args.push(`DRZ=${c.values['DRZ'] || 0}`)
                }

                // Special DOFs
                if (c.type === 'FACE_IMPO' && c.dnor) args.push(`DNOR=${c.values['DNOR'] || 0}`)
                if (c.type === 'ARETE_IMPO' && c.dtan) args.push(`DTAN=${c.values['DTAN'] || 0}`)
                if (c.type === 'PRE_EPSI') {
                    Object.entries(c.strain_tensor).forEach(([k, v]) => {
                        if (v !== 0) args.push(`${k.toUpperCase()}=${v}`)
                    })
                }

                // Determine Group Type (MA vs NO)
                const groupMeta = normalizedGroups.find(g => g.name === c.targetGroup)
                const groupKey = (groupMeta?.topology === 'NODE' || c.targetGroup.toUpperCase().includes('NODE'))
                    ? 'GROUP_NO'
                    : 'GROUP_MA'

                // Mapping ConstraintType to Aster Keyword
                // DDL_IMPO is used for both DDL constraints and generic nodal constraints
                // FACE_IMPO, ARETE_IMPO, PRE_EPSI map directly
                const keyword = c.type

                return `${c.name} = AFFE_CHAR_MECA(
    MODELE = MODELE,
    ${keyword} = _F(
        ${groupKey} = '${c.targetGroup}',
        ${args.join(', ')}
    ),
);`
            }

            const ddlCommands = constraints
                .filter(c => c.type === 'DDL_IMPO')
                .map(generateCommand)

            const faceCommands = constraints
                .filter(c => c.type === 'FACE_IMPO')
                .map(generateCommand)

            const edgeCommands = constraints
                .filter(c => c.type === 'ARETE_IMPO')
                .map(generateCommand)

            // PRE_EPSI commands (if any) could be handled similarly or added to a separate list if supported upstream
            const strainCommands = constraints
                .filter(c => c.type === 'PRE_EPSI')
                .map(generateCommand)

            // Merge PRE_EPSI into ddlCommands or handle separately depending on orchestrator?
            // For now, let's keep them in ddlCommands as generic generic mechanical charges if no specific bucket exists,
            // but the interface expects specific buckets. We'll add them to ddlCommands to ensure they are included.
            const allGenericCommands = [...ddlCommands, ...strainCommands]

            onRestrictionCommandsUpdate({
                ddlCommands: allGenericCommands,
                faceCommands,
                edgeCommands,
                validation: {
                    isValid: true,
                    errors: [],
                    warnings: []
                }
            })
        }
    }, [constraints, onRestrictionCommandsUpdate, physicsCheck, normalizedGroups])

    // --- Actions ---

    const createConstraint = (type: ConstraintType) => {
        const id = crypto.randomUUID()
        const def = CONSTRAINT_DEFS[type]
        const defaultGroup = normalizedGroups.find(g => def.allowedTopology.includes(g.topology))

        const newC: KinematicConstraint = {
            id,
            name: `BC_${constraints.length + 1}`,
            type,
            targetGroup: defaultGroup?.name || '',
            dof_trans: { x: false, y: false, z: false },
            dof_rot: { x: false, y: false, z: false },
            values: {},
            dnor: false,
            dtan: false,
            strain_tensor: { epxx: 0, epyy: 0, epzz: 0, epxy: 0, epxz: 0, epsyz: 0 }
        }
        setConstraints([...constraints, newC])
        setSelectedId(id)
    }

    const update = (field: keyof KinematicConstraint, value: any) => {
        if (!selectedId) return

        // Auto-rename duplicate constraint names
        if (field === 'name') {
            const newName = value.trim();
            const existingNames = constraints
                .filter(c => c.id !== selectedId)
                .map(c => c.name)
                .filter(name => name.startsWith(newName));

            if (existingNames.length > 0) {
                // Find the highest suffix number
                const suffixNumbers = existingNames.map(name => {
                    const match = name.match(/_(\d+)$/);
                    return match ? parseInt(match[1]) : 0;
                });

                const maxSuffix = Math.max(...suffixNumbers, 0);
                value = `${newName}_${maxSuffix + 1}`;
            }
        }

        setConstraints(prev => prev.map(c => c.id === selectedId ? { ...c, [field]: value } : c))
    }

    const updateDeep = (parent: keyof KinematicConstraint, key: string, value: any) => {
        if (!selectedId || !selected) return
        const currentObj = selected[parent] as any
        update(parent, { ...currentObj, [key]: value })
    }

    const applyPreset = (type: 'FIXED' | 'PINNED') => {
        if (!selectedId) return;

        let newRot = { x: false, y: false, z: false };
        let newTrans = { x: true, y: true, z: true };

        if (type === 'FIXED' && physicsCheck.rotAllowed) {
            newRot = { x: true, y: true, z: true };
        }

        setConstraints(prev => prev.map(c => {
            if (c.id !== selectedId) return c;
            return {
                ...c,
                dof_trans: newTrans,
                dof_rot: newRot,
                values: {
                    ...c.values,
                    'DX': 0, 'DY': 0, 'DZ': 0,
                    'DRX': 0, 'DRY': 0, 'DRZ': 0
                }
            }
        }))
    }

    if (!projectPath) return (
        <div className="h-full flex flex-col items-center justify-center bg-slate-950 text-slate-500 font-mono text-xs uppercase tracking-widest">
            Waiting for Project Selection...
        </div>
    )

    return (
        <div className="flex h-full w-full bg-slate-950 text-slate-200 font-sans border border-slate-800">

            {/* SIDEBAR */}
            <aside className="w-72 bg-slate-925 border-r border-slate-800 flex flex-col">
                <div className="p-4 border-b border-slate-800">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Add Constraint</h2>
                    <div className="grid grid-cols-2 gap-2">
                        {(Object.entries(CONSTRAINT_DEFS) as [ConstraintType, any][]).map(([key, def]) => {
                            const Icon = def.icon
                            return (
                                <button
                                    key={key}
                                    onClick={() => createConstraint(key)}
                                    disabled={normalizedGroups.length === 0}
                                    className="flex flex-col items-center justify-center p-3 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 hover:bg-slate-800 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Icon className={`w-5 h-5 mb-2 ${def.color}`} />
                                    <span className="text-[9px] font-bold text-slate-400 group-hover:text-white">{key.replace('_IMPO', '')}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {normalizedGroups.length === 0 && (
                        <div className="text-center p-4 text-[10px] text-slate-600 font-mono">
                            No groups found.<br />Load a mesh to start.
                        </div>
                    )}
                    {constraints.map(c => {
                        const def = CONSTRAINT_DEFS[c.type]
                        const Icon = def.icon
                        return (
                            <div
                                key={c.id}
                                onClick={() => setSelectedId(c.id)}
                                className={`
                                    group flex items-center justify-between p-3 rounded cursor-pointer border transition-all
                                    ${selectedId === c.id
                                        ? 'bg-slate-800 border-slate-600 shadow-lg'
                                        : 'bg-transparent border-transparent hover:bg-slate-900'}
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded ${def.bg} ${def.color}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-200">{c.name}</div>
                                        <div className="text-[9px] font-mono text-slate-500">{c.type}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setConstraints(prev => prev.filter(x => x.id !== c.id)) }}
                                    className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )
                    })}
                </div>
            </aside>

            {/* MAIN EDITOR */}
            <main className="flex-1 flex flex-col bg-slate-950 relative">
                {selected ? (
                    <>
                        <header className="h-20 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/50">
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col">
                                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-0.5">Constraint Name</label>
                                    <input
                                        value={selected.name}
                                        onChange={(e) => update('name', e.target.value)}
                                        className="bg-transparent text-xl font-bold focus:outline-none focus:border-b-2 border-blue-500 w-64 transition-all"
                                    />
                                </div>
                                <div className="mt-4 px-2 py-1 rounded bg-slate-800 text-[9px] font-black text-slate-300 border border-slate-700 uppercase tracking-[0.1em]">
                                    {selected.type.replace('_IMPO', '')}
                                </div>
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="max-w-4xl mx-auto space-y-8">

                                {/* SELEÇÃO DE GRUPOS (Relocated) */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <Box className="w-4 h-4" />
                                            <h3 className="text-[10px] font-black uppercase tracking-widest">Target Mesh Group</h3>
                                        </div>
                                        {selected.targetGroup && (
                                            <span className="text-[9px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                                Selected: {selected.targetGroup}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-2 p-1">
                                        {compatibleGroups.length > 0 ? (
                                            compatibleGroups.map(g => {
                                                const isSelected = selected.targetGroup === g.name;
                                                const def = CONSTRAINT_DEFS[selected.type];

                                                return (
                                                    <button
                                                        key={g.name}
                                                        onClick={() => update('targetGroup', g.name)}
                                                        className={`
                                                            px-4 py-2 rounded text-[10px] font-mono border transition-all flex items-center gap-2
                                                            ${isSelected
                                                                ? `${def.bg} ${def.color} border-current shadow-[0_0_10px_rgba(37,99,235,0.1)] scale-[1.02]`
                                                                : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                                                            }
                                                        `}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-current shadow-[0_0_5px_currentColor]' : 'bg-slate-800'}`} />
                                                        {g.name}
                                                        <span className="opacity-30 text-[8px] ml-1 font-sans">[{g.topology}]</span>
                                                    </button>
                                                );
                                            })
                                        ) : (
                                            <div className="w-full text-[10px] text-orange-500 italic flex items-center gap-2 bg-orange-500/5 p-4 rounded border border-orange-500/20">
                                                <AlertTriangle className="w-4 h-4" />
                                                No compatible mesh groups available for {selected.type}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* AVISO FÍSICO */}
                                {physicsCheck.warning && (
                                    <div className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded text-orange-200">
                                        <AlertTriangle className="w-5 h-5 shrink-0" />
                                        <div className="text-xs">
                                            <strong className="block uppercase mb-1">Physics Constraint</strong>
                                            {physicsCheck.warning}
                                        </div>
                                    </div>
                                )}

                                {/* PRESETS */}
                                {(selected.type === 'DDL_IMPO' || selected.type === 'ARETE_IMPO' || selected.type === 'FACE_IMPO') && (
                                    <div className="flex items-center gap-4 border-b border-slate-800 pb-6">
                                        <span className="text-[10px] font-bold uppercase text-slate-500">Quick Presets:</span>
                                        <button
                                            onClick={() => applyPreset('FIXED')}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-900 border border-slate-700 hover:border-blue-500 hover:text-blue-400 text-xs font-bold transition-all"
                                        >
                                            <Anchor className="w-3 h-3" /> Fixed
                                        </button>
                                        <button
                                            onClick={() => applyPreset('PINNED')}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-900 border border-slate-700 hover:border-emerald-500 hover:text-emerald-400 text-xs font-bold transition-all"
                                        >
                                            <MousePointer2 className="w-3 h-3" /> Pinned
                                        </button>
                                    </div>
                                )}

                                {/* INPUTS DE DOFs */}
                                {selected.type !== 'PRE_EPSI' && (
                                    <section className="space-y-6">
                                        <div className="grid grid-cols-2 gap-8">
                                            {/* Translação */}
                                            <div className="bg-slate-900/30 p-5 rounded border border-slate-800">
                                                <div className="flex items-center gap-2 mb-4 text-slate-400">
                                                    <Move3d className="w-4 h-4" />
                                                    <h3 className="text-xs font-black uppercase tracking-widest">Translation</h3>
                                                </div>
                                                <div className="space-y-3">
                                                    {(['x', 'y', 'z'] as const).map(axis => (
                                                        <DofInput
                                                            key={axis}
                                                            label={`D${axis.toUpperCase()}`}
                                                            checked={selected.dof_trans[axis]}
                                                            onToggle={(v) => updateDeep('dof_trans', axis, v)}
                                                            value={selected.values[`D${axis.toUpperCase()}`] || 0}
                                                            onValueChange={(v) => {
                                                                const newValues = { ...selected.values, [`D${axis.toUpperCase()}`]: v }
                                                                update('values', newValues)
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Rotação */}
                                            <div className={`bg-slate-900/30 p-5 rounded border border-slate-800 transition-opacity ${physicsCheck.rotAllowed ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
                                                <div className="flex items-center gap-2 mb-4 text-slate-400">
                                                    <Box className="w-4 h-4" />
                                                    <h3 className="text-xs font-black uppercase tracking-widest">Rotation</h3>
                                                </div>
                                                <div className="space-y-3">
                                                    {(['x', 'y', 'z'] as const).map(axis => (
                                                        <DofInput
                                                            key={axis}
                                                            label={`DR${axis.toUpperCase()}`}
                                                            checked={selected.dof_rot[axis]}
                                                            onToggle={(v) => updateDeep('dof_rot', axis, v)}
                                                            value={selected.values[`DR${axis.toUpperCase()}`] || 0}
                                                            onValueChange={(v) => {
                                                                const newValues = { ...selected.values, [`DR${axis.toUpperCase()}`]: v }
                                                                update('values', newValues)
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {/* INPUTS ESPECIAIS */}
                                {selected.type === 'FACE_IMPO' && (
                                    <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <ArrowUpFromLine className="w-5 h-5 text-purple-400" />
                                            <div>
                                                <div className="text-xs font-bold text-purple-100">Normal Displacement (DNOR)</div>
                                                <div className="text-[10px] text-purple-300/60">Displacement perpendicular to surface</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={selected.dnor}
                                                onChange={(e) => update('dnor', e.target.checked)}
                                                className="toggle toggle-sm accent-purple-500"
                                            />
                                            {selected.dnor && (
                                                <input
                                                    type="text"
                                                    className="w-24 bg-slate-950 border border-purple-500/50 rounded px-2 py-1 text-xs font-mono"
                                                    value={selected.values['DNOR'] || 0}
                                                    onChange={(e) => {
                                                        const newValues = { ...selected.values, 'DNOR': e.target.value }
                                                        update('values', newValues)
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {selected.type === 'ARETE_IMPO' && (
                                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Minus className="w-5 h-5 text-emerald-400" />
                                            <div>
                                                <div className="text-xs font-bold text-emerald-100">Tangent Displacement (DTAN)</div>
                                                <div className="text-[10px] text-emerald-300/60">Displacement along the edge vector</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={selected.dtan}
                                                onChange={(e) => update('dtan', e.target.checked)}
                                                className="accent-emerald-500"
                                            />
                                            {selected.dtan && (
                                                <input
                                                    type="text"
                                                    className="w-24 bg-slate-950 border border-emerald-500/50 rounded px-2 py-1 text-xs font-mono"
                                                    value={selected.values['DTAN'] || 0}
                                                    onChange={(e) => {
                                                        const newValues = { ...selected.values, 'DTAN': e.target.value }
                                                        update('values', newValues)
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {selected.type === 'PRE_EPSI' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-slate-400 pb-2 border-b border-slate-800">
                                            <Maximize2 className="w-4 h-4" />
                                            <h3 className="text-xs font-black uppercase tracking-widest">Strain Tensor Components</h3>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            {Object.keys(selected.strain_tensor).map(comp => (
                                                <div key={comp} className="flex flex-col gap-1">
                                                    <label className="text-[10px] font-mono uppercase text-slate-500">{comp}</label>
                                                    <input
                                                        type="number"
                                                        step="0.001"
                                                        className="bg-slate-900 border border-slate-700 rounded p-2 text-xs font-mono focus:border-amber-500 outline-none"
                                                        value={selected.strain_tensor[comp as keyof typeof selected.strain_tensor]}
                                                        onChange={(e) => updateDeep('strain_tensor', comp, parseFloat(e.target.value))}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="p-3 bg-amber-900/10 border border-amber-500/20 rounded flex gap-2 items-center text-[10px] text-amber-200/70">
                                            <AlertCircle className="w-3 h-3" />
                                            Check conflict: Ensure these nodes do not have fixed DDLs on the same directions.
                                        </div>
                                    </div>
                                )}

                                {/* CODE PREVIEW RETRÁTIL */}
                                <div className="border-t border-slate-800 mt-4">
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
                                                <button className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-white">
                                                    <Copy className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <pre className="p-4 bg-slate-900 rounded-b border-x border-b border-slate-800 font-mono text-xs text-blue-300 leading-relaxed overflow-x-auto">
                                                {generatedCode}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                        <Shield className="w-16 h-16 text-slate-500 mb-4" />
                        <div className="text-sm font-black uppercase tracking-widest">Kinematic Manager</div>
                        <p className="text-xs font-mono mt-2">Select or create a constraint</p>
                    </div>
                )}
            </main>
        </div>
    )
}

function DofInput({ label, checked, onToggle, value, onValueChange }: {
    label: string, checked: boolean, onToggle: (v: boolean) => void, value: string | number, onValueChange: (v: string) => void
}) {
    return (
        <div className="flex items-center gap-3">
            <button
                onClick={() => onToggle(!checked)}
                className={`w-12 h-8 rounded flex items-center justify-center text-[10px] font-black transition-all border
                    ${checked
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-500'}
                `}
            >
                {label}
            </button>
            <div className={`flex-1 h-8 bg-slate-950 border border-slate-800 rounded flex items-center px-3 transition-opacity ${checked ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                <span className="text-[10px] text-slate-500 font-mono mr-2">=</span>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onValueChange(e.target.value)}
                    className="bg-transparent w-full text-xs font-mono focus:outline-none text-white placeholder-slate-700"
                    placeholder="0.0"
                />
            </div>
        </div>
    )
}