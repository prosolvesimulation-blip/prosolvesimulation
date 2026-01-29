import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
    Link2, Plus, Trash2, Shield, Zap, 
    CheckCircle, Search, Layers, 
    Settings, Brain, AlertCircle, X, ChevronDown,
    Info, Sliders, Box, Square, Activity, CircleDot,
    Lock, RefreshCw, Anchor, FileCode2, Copy, ChevronUp,
    AlertTriangle
} from 'lucide-react'
import { contactIntelligence, createContactDefinition } from '../../lib/codeAster/builders/contactIntelligence'

// --- TYPES & INTERFACES ---

interface ContactConfigProps {
    projectPath: string | null;
    availableGroups: string[];
    initialContacts?: any[];
    onUpdate: (data: any[]) => void;
}

interface ContactItem {
    id: string;
    name: string;
    master: string | null;
    slave: string | null;
    type: 'COLLAGE' | 'GLISSEMENT' | 'FROTTEMENT' | 'LIAISON_DDL' | 'LIAISON_MAIL' | 'LIAISON_GROUP' | 'LIAISON_SOLIDE' | 'LIAISON_ELEM';
    params: Record<string, any>;
    isValid: boolean;
}

interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

type ParameterDef = {
    label: string;
    asterKeyword: string;
    type: 'select' | 'number' | 'toggle' | 'readonly' | 'hidden'; // Adicionado 'hidden' para esconder o TYPE_RACCORD da lista genérica
    options?: string[];
    optionLabels?: Record<string, string>;
    default: any;
    description: string;
    unit?: string;
};

// --- VALIDATION FUNCTION ---

/**
 * Validates contact configuration
 */
function validateContactConfiguration(contact: ContactItem): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Check required fields
    if (!contact.master) {
        errors.push('Master group is required')
    }
    
    if (!contact.slave) {
        errors.push('Slave group is required')
    }
    
    if (contact.master === contact.slave) {
        errors.push('Master and slave groups must be different')
    }
    
    // Validate contact type
    if (!['COLLAGE', 'GLISSEMENT', 'FROTTEMENT'].includes(contact.type)) {
        errors.push('Invalid contact type')
    }
    
    // Type-specific validation
    if (contact.type === 'FROTTEMENT') {
        const friction = contact.params?.COULOMB
        if (friction !== undefined && (friction < 0 || friction > 1)) {
            warnings.push('Friction coefficient should be between 0 and 1')
        }
    }
    
    if (contact.type === 'COLLAGE') {
        const distance = contact.params?.DISTANCE_MAX
        if (distance !== undefined && distance < 0) {
            warnings.push('Maximum projection distance should be positive')
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    }
}

// --- DEFINIÇÕES DE PARÂMETROS ---
const CONTACT_LOGIC: Record<string, ParameterDef[]> = {
    'COLLAGE': [
        {
            label: "Connection Topology",
            asterKeyword: "TYPE_RACCORD",
            type: "hidden", // Escondido da lista genérica, pois tem UI dedicada
            default: "MASSIF",
            description: "Physical behavior of the connection (Solid vs Structural)."
        },
        {
            label: "Eliminate Multipliers",
            asterKeyword: "ELIM_MULT",
            type: "toggle",
            default: "OUI",
            description: "If Enabled (OUI), eliminates redundant Lagrange multipliers. Strongly recommended for conforming meshes."
        },
        {
            label: "Max Projection Dist.",
            asterKeyword: "DISTANCE_MAX",
            type: "number",
            default: 0.0,
            unit: "m",
            description: "Maximum search distance for projection. Nodes further than this will not be tied."
        }
    ],
    'GLISSEMENT': [
        {
            label: "Formulation",
            asterKeyword: "FORMULATION",
            type: "select",
            options: ["CONTINUE", "DISCRETE"],
            optionLabels: { "CONTINUE": "Continuous (Recommended)", "DISCRETE": "Discrete" },
            default: "CONTINUE",
            description: "'Continuous' (Augmented Lagrangian) is robust for 3D. 'Discrete' is simpler."
        },
        {
            label: "Normal Smoothing",
            asterKeyword: "LISSAGE",
            type: "toggle",
            default: "OUI",
            description: "Smoothes normals on master surface. Vital for curved sliding surfaces."
        },
        {
            label: "Geometric Algo",
            asterKeyword: "ALGO_RESO_GEOM",
            type: "select",
            options: ["POINT_FIXE", "NEWTON"],
            optionLabels: { "POINT_FIXE": "Fixed Point (Robust)", "NEWTON": "Newton (Fast)" },
            default: "POINT_FIXE",
            description: "Strategy for contact updates. Fixed Point is safer for large displacements."
        }
    ],
    'FROTTEMENT': [
        {
            label: "Formulation",
            asterKeyword: "FORMULATION",
            type: "select",
            options: ["CONTINUE", "DISCRETE"],
            optionLabels: { "CONTINUE": "Continuous", "DISCRETE": "Discrete" },
            default: "CONTINUE",
            description: "'Continuous' is highly recommended for friction convergence."
        },
        {
            label: "Friction Algorithm",
            asterKeyword: "ALGO_RESO_FROT",
            type: "select",
            options: ["NEWTON", "POINT_FIXE"],
            optionLabels: { "NEWTON": "Newton (Non-Symmetric)", "POINT_FIXE": "Fixed Point (Symmetric)" },
            default: "NEWTON",
            description: "'Newton' converges faster (requires non-symmetric solver). 'Fixed Point' preserves symmetry."
        },
        {
            label: "Normal Smoothing",
            asterKeyword: "LISSAGE",
            type: "toggle",
            default: "OUI",
            description: "Smoothes normals. Critical for friction to prevent artificial locking."
        }
    ]
};

const CONTACT_TYPES = [
    { id: 'COLLAGE', label: 'Bonded', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-500/30' },
    { id: 'GLISSEMENT', label: 'Sliding', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-500/30' },
    { id: 'FROTTEMENT', label: 'Friction', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-500/30' },
    { id: 'LIAISON_DDL', label: 'DOF Relations', color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-500/30' },
    { id: 'LIAISON_MAIL', label: 'Mesh Relations', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-500/30' },
    { id: 'LIAISON_GROUP', label: 'Group Relations', color: 'text-indigo-400', bg: 'bg-indigo-400/10', border: 'border-indigo-500/30' },
    { id: 'LIAISON_SOLIDE', label: 'Rigid Body', color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-500/30' },
    { id: 'LIAISON_ELEM', label: 'Element Relations', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-500/30' }
] as const;

// --- SUB-COMPONENT: GROUP SELECTOR ---

interface GroupSelectorProps {
    type: 'master' | 'slave';
    allGroups: string[];
    groupDimensions: Record<string, number>;
    selectedGroup: string | null;
    otherSideGroup: string | null;
    onSelect: (group: string | null) => void;
}

const GroupSelector: React.FC<GroupSelectorProps> = ({ 
    type, 
    allGroups, 
    groupDimensions,
    selectedGroup, 
    otherSideGroup, 
    onSelect 
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const availableOptions = useMemo(() => {
        return allGroups.filter(g => {
            const matchesSearch = g.toLowerCase().includes(searchTerm.toLowerCase());
            const isAvailable = g !== otherSideGroup;
            return matchesSearch && isAvailable;
        });
    }, [allGroups, searchTerm, otherSideGroup]);

    const HeaderIcon = type === 'master' ? Shield : Zap;
    const themeColor = type === 'master' ? 'text-cyan-400' : 'text-amber-400';
    const activeBg = type === 'master' ? 'bg-cyan-500' : 'bg-amber-500';
    const activeShadow = type === 'master' ? 'shadow-cyan-500/20' : 'shadow-amber-500/20';

    const getDimIcon = (groupName: string) => {
        const dim = groupDimensions[groupName] ?? 3; 
        switch (dim) {
            case 0: return <CircleDot size={12} className="text-rose-400" strokeWidth={2.5} />; // 0D - Nó
            case 1: return <Activity size={12} className="text-blue-400" strokeWidth={2.5} />; // 1D
            case 2: return <Square size={12} className="text-emerald-400" strokeWidth={2.5} />; // 2D
            case 3: return <Box size={12} className="text-purple-400" strokeWidth={2.5} />; // 3D
            default: return <Box size={12} className="text-slate-500" />;
        }
    };

    const getDimLabel = (groupName: string) => {
        const dim = groupDimensions[groupName];
        if (dim === 0) return '0D';
        if (dim === undefined) return '3D';
        return `${dim}D`;
    };

    return (
        <div className="flex flex-col w-full bg-slate-950/50 rounded-xl border border-slate-800 overflow-hidden h-[240px]">
            <div className="p-3 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <HeaderIcon className={`w-3 h-3 ${themeColor}`} />
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                            {type} Group
                        </span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-600">
                        {availableOptions.length} items
                    </span>
                </div>
                
                <div className="relative group">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 group-focus-within:text-white transition-colors" />
                    <input 
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-950 rounded-lg py-1.5 pl-8 pr-2 text-[10px] text-white border border-slate-800 focus:border-slate-600 outline-none transition-all placeholder:text-slate-600"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                            <X size={10} />
                        </button>
                    )}
                </div>
            </div>

            <div className="p-2 space-y-1 overflow-y-auto custom-scrollbar">
                {availableOptions.length === 0 ? (
                    <div className="py-8 flex flex-col items-center justify-center text-slate-600 gap-2 opacity-60">
                        <Layers size={24} strokeWidth={1.5} />
                        <span className="text-[10px] font-bold uppercase">No groups found</span>
                    </div>
                ) : (
                    availableOptions.map(group => {
                        const isSelected = selectedGroup === group;
                        return (
                            <button
                                key={group}
                                onClick={() => onSelect(isSelected ? null : group)}
                                className={`
                                    w-full flex items-center px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all duration-200 group
                                    ${isSelected 
                                        ? `${activeBg} text-white shadow-lg ${activeShadow} translate-x-1` 
                                        : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300 bg-slate-900/40 border border-transparent hover:border-slate-700'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`p-1 rounded shrink-0 ${isSelected ? 'bg-white/20' : 'bg-slate-950 border border-slate-800'}`}>
                                        {getDimIcon(group)}
                                    </div>
                                    <span className="truncate">{group}</span>
                                </div>

                                <div className="ml-auto pl-2 flex items-center gap-2">
                                    <span className={`text-[9px] font-mono font-black opacity-60 bg-black/20 px-1.5 py-0.5 rounded ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                                        {getDimLabel(group)}
                                    </span>
                                    {isSelected && (
                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                            <CheckCircle size={12} className="text-white" />
                                        </motion.div>
                                    )}
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: ADVANCED PARAMETERS ---

interface AdvancedParamsProps {
    type: string;
    params: Record<string, any>;
    onChange: (key: string, value: any) => void;
}

const AdvancedParams: React.FC<AdvancedParamsProps> = ({ type, params, onChange }) => {
    // Filtra para remover TYPE_RACCORD (mostrado na UI especial) e COULOMB (mostrado no painel lateral)
    const paramDefs = CONTACT_LOGIC[type]?.filter(p => p.asterKeyword !== 'COULOMB' && p.type !== 'hidden') || [];

    if (paramDefs.length === 0) return null;

    return (
        <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-slate-950/30 border border-slate-800 rounded-xl p-4 space-y-4"
        >
            <div className="flex items-center gap-2 mb-2 border-b border-slate-800/50 pb-2">
                <Sliders size={12} className="text-slate-500" />
                <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    Advanced Settings <span className="opacity-50 font-normal normal-case ml-1">- Code_Aster</span>
                </h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {paramDefs.map((def) => {
                    const value = params[def.asterKeyword] ?? def.default;

                    return (
                        <div key={def.asterKeyword} className="space-y-1.5 group">
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
                                            onChange={(e) => onChange(def.asterKeyword, e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-8 py-1.5 text-[10px] text-white focus:border-cyan-500 focus:bg-slate-800 outline-none font-mono appearance-none transition-all cursor-pointer hover:border-slate-600"
                                        >
                                            {def.options?.map(opt => (
                                                <option key={opt} value={opt}>
                                                    {def.optionLabels && def.optionLabels[opt] ? def.optionLabels[opt] : opt}
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

                                {def.type === 'number' && (
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={value}
                                            onChange={(e) => onChange(def.asterKeyword, parseFloat(e.target.value))}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-[10px] text-white focus:border-cyan-500 outline-none font-mono transition-all"
                                        />
                                        {def.unit && (
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-600 font-mono">
                                                {def.unit}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
};

// --- SUB-COMPONENT: TOPOLOGY SELECTOR (A "BIFURCAÇÃO" INTELIGENTE) ---

interface TopologySelectorProps {
    currentValue: string;
    slaveIsZeroD: boolean;
    onChange: (val: string) => void;
}

const TopologySelector: React.FC<TopologySelectorProps> = ({ currentValue, slaveIsZeroD, onChange }) => {
    
    // Lista de Opções Mapeadas para a Tabela de Decisão Física
    const options = [
        {
            id: 'MASSIF',
            label: 'Pinned / Solid',
            icon: Lock,
            desc: 'Connects translations only (XYZ). Use for Solid-Solid or Hinged/Pinned beams.',
            keywords: 'DOF: DX, DY, DZ',
            color: 'text-emerald-400',
            bg: 'bg-emerald-400/10',
            border: 'border-emerald-500/20',
            disabled: false
        },
        {
            id: 'COQUE',
            label: 'Structural Weld',
            icon: RefreshCw, // Representando rotação
            desc: 'Rigid connection (XYZ + Rotations). Use for Shell-Shell or Beam-Beam.',
            keywords: 'DOF: ALL (6 DOFs)',
            color: 'text-indigo-400',
            bg: 'bg-indigo-400/10',
            border: 'border-indigo-500/20',
            disabled: slaveIsZeroD // Desabilita se for nó isolado
        },
        {
            id: 'MASSIF_COQUE',
            label: 'Embedment',
            icon: Anchor,
            desc: 'Mixed connection. Embeds a Beam/Shell into a Solid Face. Transmits moment.',
            keywords: 'Hybrid (3D ↔ Structural)',
            color: 'text-amber-400',
            bg: 'bg-amber-400/10',
            border: 'border-amber-500/20',
            disabled: slaveIsZeroD // Desabilita se for nó isolado
        }
    ];

    return (
        <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                    <Activity size={12} /> Connection Physics <span className="text-slate-600 font-normal normal-case">(Declaration of Intent)</span>
                </label>
                {slaveIsZeroD && (
                    <span className="text-[9px] text-rose-400 bg-rose-950/30 px-2 py-0.5 rounded border border-rose-900/50 flex items-center gap-1">
                        <AlertCircle size={8} /> Node Groups (0D) are Pinned only
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 gap-2">
                {options.map((opt) => {
                    const isSelected = currentValue === opt.id;
                    const isDisabled = opt.disabled;

                    return (
                        <button
                            key={opt.id}
                            onClick={() => !isDisabled && onChange(opt.id)}
                            disabled={isDisabled}
                            className={`
                                relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all group
                                ${isDisabled ? 'opacity-40 cursor-not-allowed bg-slate-950 border-slate-900' : ''}
                                ${isSelected 
                                    ? `${opt.bg} ${opt.border} shadow-lg shadow-black/20 ring-1 ring-inset ${opt.color.replace('text', 'ring')}` 
                                    : !isDisabled && 'bg-slate-900/40 border-slate-800 hover:bg-slate-900 hover:border-slate-700'
                                }
                            `}
                        >
                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/10 text-white' : 'bg-slate-950 border border-slate-800 text-slate-500'}`}>
                                <opt.icon size={16} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                                        {opt.label}
                                    </span>
                                    {isSelected && <CheckCircle size={10} className={opt.color} />}
                                </div>
                                <div className="text-[9px] text-slate-500 leading-tight">
                                    {opt.desc}
                                </div>
                            </div>

                            <div className={`text-[8px] font-mono px-1.5 py-0.5 rounded border opacity-70 ${isSelected ? 'border-white/20 text-white' : 'border-slate-800 text-slate-600 bg-slate-950'}`}>
                                {opt.keywords}
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    );
};


// --- SUB-COMPONENT: CONTACT CARD ---

interface ContactCardProps {
    contact: ContactItem;
    availableGroups: string[];
    groupDimensions: Record<string, number>;
    onUpdate: (id: string, field: keyof ContactItem | string, value: any) => void;
    onRemove: (id: string) => void;
}

const ContactCard: React.FC<ContactCardProps> = ({ contact, availableGroups, groupDimensions, onUpdate, onRemove }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isCodeOpen, setIsCodeOpen] = useState(true);
    const isComplete = contact.master && contact.slave && contact.type;

    // Detect if Slave is likely a Node/0D group to enable Guard Rails
    const slaveIsZeroD = useMemo(() => {
        if (!contact.slave) return false;
        const dim = groupDimensions[contact.slave];
        return dim === 0; // Explicitly 0D
    }, [contact.slave, groupDimensions]);

    const handleParamChange = (key: string, value: any) => {
        const newParams = { ...contact.params, [key]: value };
        onUpdate(contact.id, 'params', newParams);
    };

    const handleTypeChange = (newType: 'COLLAGE' | 'GLISSEMENT' | 'FROTTEMENT' | 'LIAISON_DDL' | 'LIAISON_MAIL' | 'LIAISON_GROUP' | 'LIAISON_SOLIDE' | 'LIAISON_ELEM') => {
        const defaults: Record<string, any> = {};
        CONTACT_LOGIC[newType]?.forEach(def => {
            defaults[def.asterKeyword] = def.default;
        });

        if (newType === 'FROTTEMENT') defaults['COULOMB'] = 0.3;
        
        // Reset topology to safe default when switching types
        if (newType === 'COLLAGE') {
             defaults['TYPE_RACCORD'] = 'MASSIF';
        }

        onUpdate(contact.id, 'type', newType);
        onUpdate(contact.id, 'params', defaults);
    };

    // Code_Aster command generation using new intelligence
    const generatedCode = useMemo(() => {
        if (!contact.master || !contact.slave) {
            return `// Error: Master and slave groups must be selected`;
        }

        // Create contact definition from current configuration
        const contactDef = createContactDefinition(
            contact.name,
            contact.master,
            contact.slave,
            contact.type as any,
            contact.params
        );

        // Generate command using intelligence
        const result = contactIntelligence.generateContactCommand(contactDef);
        
        if (!result.validation.isValid) {
            return `// Error: ${result.validation.errors.join(', ')}`;
        }
        
        return result.command;
    }, [contact]);

    // Real-time validation
    const validationResult = useMemo(() => {
        return validateContactConfiguration(contact);
    }, [contact]);

    // Copy to clipboard function
    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(generatedCode);
        } catch (err) {
            console.error('Failed to copy command:', err);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`
                rounded-2xl border transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md
                ${isComplete ? 'bg-slate-900 border-slate-800' : 'bg-slate-900/50 border-slate-800 border-dashed'}
            `}
        >
            <div 
                className="p-4 flex items-center justify-between gap-4 bg-slate-900 border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-4 flex-1">
                    <div className={`p-2 rounded-lg transition-colors ${isComplete ? 'bg-cyan-500/10 text-cyan-400' : 'bg-slate-800 text-slate-500'}`}>
                        {isComplete ? <Link2 size={18} /> : <AlertCircle size={18} />}
                    </div>
                    
                    <div className="flex-1">
                        <div onClick={(e) => e.stopPropagation()}>
                            <input
                                value={contact.name}
                                onChange={(e) => onUpdate(contact.id, 'name', e.target.value)}
                                className="bg-transparent text-sm font-black text-white uppercase tracking-wide outline-none focus:text-cyan-400 w-full placeholder-slate-600 cursor-text"
                                placeholder="NAME YOUR CONTACT PAIR"
                            />
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                            <span className={contact.master ? 'text-cyan-400' : 'text-slate-600'}>{contact.master || 'SELECT MASTER'}</span>
                            <span className="opacity-30">→</span>
                            <span className={contact.slave ? 'text-amber-400' : 'text-slate-600'}>{contact.slave || 'SELECT SLAVE'}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex gap-1 mr-2">
                        {!isExpanded && contact.type && (
                            <motion.span 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider border ${
                                CONTACT_TYPES.find(t => t.id === contact.type)?.bg || 'bg-slate-800'
                            } ${CONTACT_TYPES.find(t => t.id === contact.type)?.border} ${CONTACT_TYPES.find(t => t.id === contact.type)?.color || 'text-slate-400'}`}>
                                {CONTACT_TYPES.find(t => t.id === contact.type)?.label}
                            </motion.span>
                        )}
                    </div>
                    <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors">
                        <ChevronDown size={16} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onRemove(contact.id); }}
                        className="p-2 hover:bg-rose-500/10 text-slate-600 hover:text-rose-500 rounded-lg transition-colors"
                        title="Remove Pair"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 space-y-6 bg-slate-900/50">
                            {/* SELETORES DE GRUPO LADO A LADO */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                <GroupSelector
                                    type="master"
                                    allGroups={availableGroups}
                                    groupDimensions={groupDimensions}
                                    selectedGroup={contact.master}
                                    otherSideGroup={contact.slave}
                                    onSelect={(g) => onUpdate(contact.id, 'master', g)}
                                />
                                <GroupSelector
                                    type="slave"
                                    allGroups={availableGroups}
                                    groupDimensions={groupDimensions}
                                    selectedGroup={contact.slave}
                                    otherSideGroup={contact.master}
                                    onSelect={(g) => onUpdate(contact.id, 'slave', g)}
                                />
                            </div>

                            <div className="pt-6 border-t border-slate-800/50">
                                <div className="flex flex-col md:flex-row gap-6 items-start">
                                    
                                    {/* COLUNA ESQUERDA: TIPO E CONFIGURAÇÃO */}
                                    <div className="flex-1 space-y-5 w-full">
                                        
                                        {/* SELETOR DE TIPO PRINCIPAL */}
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-2 mb-3">
                                                <Settings size={12} /> Contact Interaction Type
                                            </label>
                                            <div className="grid grid-cols-3 gap-3">
                                                {CONTACT_TYPES.map((t) => {
                                                    const isSelected = contact.type === t.id;
                                                    return (
                                                        <button
                                                            key={t.id}
                                                            onClick={() => handleTypeChange(t.id as any)}
                                                            className={`
                                                                relative p-3 rounded-xl border text-left transition-all group
                                                                ${isSelected 
                                                                    ? `${t.bg} ${t.border} ${t.color} shadow-lg shadow-black/20` 
                                                                    : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:bg-slate-900 hover:border-slate-700'
                                                                }
                                                            `}
                                                        >
                                                            <div className="text-[10px] font-black uppercase tracking-wider mb-1">{t.label}</div>
                                                            <div className={`text-[9px] font-mono transition-opacity ${isSelected ? 'opacity-80' : 'opacity-40'}`}>
                                                                CODE: {t.id}
                                                            </div>
                                                            {isSelected && (
                                                                <div className="absolute top-2 right-2">
                                                                    <CheckCircle size={12} />
                                                                </div>
                                                            )}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* TOPOLOGY SELECTOR (SÓ APARECE SE FOR BONDED/COLLAGE) */}
                                        {contact.type === 'COLLAGE' && (
                                            <TopologySelector 
                                                currentValue={contact.params['TYPE_RACCORD']}
                                                slaveIsZeroD={slaveIsZeroD}
                                                onChange={(val) => handleParamChange('TYPE_RACCORD', val)}
                                            />
                                        )}

                                        {/* PARÂMETROS GENÉRICOS (OUTROS) */}
                                        {contact.type && (
                                            <AdvancedParams 
                                                type={contact.type} 
                                                params={contact.params} 
                                                onChange={handleParamChange} 
                                            />
                                        )}
                                    </div>

                                    {/* COLUNA DIREITA: PARÂMETROS FÍSICOS ESPECÍFICOS (FROTTEMENT) */}
                                    <AnimatePresence mode='wait'>
                                        {contact.type === 'FROTTEMENT' && (
                                            <motion.div
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                className="w-full md:w-56 space-y-3 pt-7"
                                            >
                                                <div className="bg-gradient-to-br from-rose-500/10 to-rose-900/10 border border-rose-500/20 rounded-xl p-4 shadow-lg shadow-rose-900/10">
                                                    <div className="flex items-center gap-2 mb-3 text-rose-400">
                                                        <Brain size={14} />
                                                        <span className="text-[10px] font-black uppercase tracking-wider">Physics Parameter</span>
                                                    </div>
                                                    
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] text-slate-400 font-bold uppercase">Friction Coeff (COULOMB)</label>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                max="1"
                                                                value={contact.params['COULOMB'] ?? 0.3}
                                                                onChange={(e) => handleParamChange('COULOMB', parseFloat(e.target.value))}
                                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-rose-500 outline-none font-mono"
                                                            />
                                                            <span className="text-xs text-slate-500">μ</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* CODE_ASTER COMMAND PREVIEW */}
                            <div className="border-t border-slate-800/50 mt-6 pt-6">
                                <button 
                                    onClick={() => setIsCodeOpen(!isCodeOpen)}
                                    className="w-full flex items-center justify-between py-3 hover:bg-slate-900 transition-colors"
                                >
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <FileCode2 className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Aster Command Preview</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* Validation Status Indicator */}
                                        <div className={`w-2 h-2 rounded-full ${validationResult.isValid ? 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(248,113,113,0.5)]'}`} />
                                        <ChevronUp className={`w-4 h-4 text-slate-600 transition-transform ${isCodeOpen ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>
                                
                                {isCodeOpen && (
                                    <div className="mt-4 space-y-4">
                                        {/* Validation Errors/Warnings */}
                                        {!validationResult.isValid && (
                                            <div className="flex items-start gap-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded text-rose-200">
                                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                                <div className="text-xs">
                                                    <strong className="block uppercase mb-1">Validation Errors</strong>
                                                    {validationResult.errors.map((error, idx) => (
                                                        <div key={idx} className="mb-1">• {error}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {validationResult.warnings.length > 0 && (
                                            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded text-amber-200">
                                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                                <div className="text-xs">
                                                    <strong className="block uppercase mb-1">Warnings</strong>
                                                    {validationResult.warnings.map((warning, idx) => (
                                                        <div key={idx} className="mb-1">• {warning}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Code Preview */}
                                        <div className="relative">
                                            <div className="absolute right-2 top-2 flex gap-2">
                                                <button
                                                    onClick={copyToClipboard}
                                                    className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-400 hover:text-white transition-all"
                                                    title="Copy to clipboard"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs text-cyan-400 font-mono overflow-x-auto">
                                                <code>{generatedCode}</code>
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// --- MAIN COMPONENT ---

const ContactConfig: React.FC<ContactConfigProps> = ({ 
    projectPath, 
    availableGroups, 
    initialContacts, 
    onUpdate 
}) => {
    // --- ESTADO INTERNO DE DIMENSÕES ---
    const [localGroupDimensions, setLocalGroupDimensions] = useState<Record<string, number>>({});

    useEffect(() => {
        const globalState = (window as any).projectState?.meshes;
        
        if (globalState) {
            const dims: Record<string, number> = {};
            Object.values(globalState).forEach((fileData: any) => {
                if (fileData.groups) {
                    Object.entries(fileData.groups).forEach(([gName, gInfo]: [string, any]) => {
                        const cat = gInfo.category;
                        if (cat === '1D') dims[gName] = 1;
                        else if (cat === '2D') dims[gName] = 2;
                        else if (cat === '3D') dims[gName] = 3;
                        else if (cat === 'Node' || cat === '0D' || cat === 'Point') dims[gName] = 0; 
                        else dims[gName] = 3; 
                    });
                }
            });
            console.log("DEBUG: [ContactConfig] Detected group dimensions:", dims);
            setLocalGroupDimensions(dims);
        }
    }, [availableGroups]);

    function initParams(type: string) {
        const defaults: Record<string, any> = {};
        CONTACT_LOGIC[type]?.forEach(def => {
            defaults[def.asterKeyword] = def.default;
        });
        if (type === 'FROTTEMENT') defaults['COULOMB'] = 0.3;
        return defaults;
    }

    const [contacts, setContacts] = useState<ContactItem[]>(() => {
        if (!initialContacts) return [];
        return initialContacts.map(c => ({
            id: c.id || `CONTACT_${Date.now()}_${Math.random()}`,
            name: c.name || 'New Contact',
            master: c.master || null,
            slave: c.slave || null,
            type: c.type || 'COLLAGE',
            params: c.params || { ...initParams(c.type || 'COLLAGE') },
            isValid: true
        }));
    });

    useEffect(() => {
        onUpdate(contacts);
    }, [contacts, onUpdate]);

    const addContact = () => {
        const type = 'COLLAGE';
        const newContact: ContactItem = {
            id: `CONTACT_${Date.now()}`,
            name: `Contact Pair ${contacts.length + 1}`,
            master: null,
            slave: null,
            type: type,
            params: initParams(type),
            isValid: false
        };
        setContacts([...contacts, newContact]);
    };

    const removeContact = (id: string) => {
        setContacts(contacts.filter(c => c.id !== id));
    };

    const updateContact = (id: string, field: keyof ContactItem | string, value: any) => {
        setContacts(prevContacts => prevContacts.map(c => {
            if (c.id !== id) return c;
            if (field === 'params') {
                return { ...c, params: value as Record<string, any> };
            }
            return { ...c, [field]: value };
        }));
    };

    if (!projectPath) return <div className="p-20 text-slate-500 font-mono text-center">NO PROJECT ACTIVE</div>;

    return (
        <div className="h-full bg-slate-1000 overflow-y-auto p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center justify-between border-b border-slate-800 pb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                            <Brain size={24} className="text-cyan-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Contact Pairs</h2>
                            <p className="text-slate-400 text-xs font-medium uppercase tracking-widest opacity-60">
                                Intelligent Master/Slave Definition
                            </p>
                        </div>
                    </div>
                    
                    <button
                        onClick={addContact}
                        className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-cyan-900/20 active:scale-95"
                    >
                        <Plus size={16} /> New Pair
                    </button>
                </div>

                <div className="space-y-6">
                    <AnimatePresence mode='popLayout'>
                        {contacts.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="p-16 border-2 border-dashed border-slate-800 rounded-3xl text-center"
                            >
                                <Layers size={48} className="text-slate-800 mx-auto mb-4" />
                                <p className="text-xs font-black text-slate-700 uppercase tracking-widest">No Contacts Defined</p>
                                <p className="text-[10px] text-slate-600 mt-2">Create a new pair to define interaction physics</p>
                            </motion.div>
                        ) : (
                            contacts.map((contact) => (
                                <ContactCard
                                    key={contact.id}
                                    contact={contact}
                                    availableGroups={availableGroups}
                                    groupDimensions={localGroupDimensions} 
                                    onUpdate={updateContact}
                                    onRemove={removeContact}
                                />
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

export default ContactConfig