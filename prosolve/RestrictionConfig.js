// =========================================================
// ARQUIVO: RestrictionConfig.js
// PATH: prosolve/RestrictionConfig.js
// =========================================================

const React = window.React || require('react');
const { useState, useEffect } = React;

const RestrictionConfig = () => {
    const [restrictions, setRestrictions] = useState([]);
    const [availableGroups, setAvailableGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);

    // --- REGRAS DE NEGÓCIO (Code_Aster) ---
    const LOGIC_MAPPING = {
        '2D': {
            type: 'FACE_IMPO',
            icon: '⬛',
            label: 'FACE_IMPO',
            fields: ['DX', 'DY', 'DZ', 'DNOR']
        },
        '1D': {
            type: 'ARETE_IMPO',
            icon: '📏',
            label: 'ARETE_IMPO',
            fields: ['DX', 'DY', 'DZ', 'DTAN']
        },
        'Point': {
            type: 'DDL_IMPO',
            icon: '📍',
            label: 'DDL_IMPO',
            fields: ['DX', 'DY', 'DZ', 'DRX', 'DRY', 'DRZ']
        },
        'Node': {
            type: 'DDL_IMPO',
            icon: '📍',
            label: 'DDL_IMPO',
            fields: ['DX', 'DY', 'DZ', 'DRX', 'DRY', 'DRZ']
        }
    };

    // --- 1. SETUP INICIAL ---
// --- 1. CARREGAR E FILTRAR DADOS ---
    useEffect(() => {
        const loadRawData = async () => {
            let rawGroups = {};
            
            // Tenta pegar do cache global PRIMEIRO (Preenchido pelo ModelConfig ou Workspace)
            if (window.projectState?.meshAnalysis) {
                rawGroups = window.projectState.meshAnalysis;
            } else {
                // Se não tiver no cache, busca no disco (Segurança)
                try {
                    const resp = await fetch('http://localhost:5000/api/read_mesh_groups', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ folder_path: window.projectState?.projectPath })
                    });
                    const json = await resp.json();
                    if (json.status === 'success') rawGroups = json.data.groups;
                } catch (e) { console.error("Restriction load error", e); }
            }

            // Processa usando o CLASSIFICADOR GLOBAL
            const processedGroups = Object.entries(rawGroups)
                .map(([name, info]) => ({
                    name: name,
                    type: Object.keys(info.types).join(', '),
                    category: window.classifyMeshGroup(info.types) // <--- USA A LÓGICA GLOBAL
                }))
                // FILTRO: Restrictions aceita tudo, MENOS volume 3D
                .filter(g => g.category !== '3D'); 

            setAvailableGroups(processedGroups);

            // Carrega restrições salvas
            const savedRestrictions = window.projectState?.restrictions || [];
            setRestrictions(savedRestrictions);

            if (!selectedGroup && processedGroups.length > 0) {
                setSelectedGroup(processedGroups[0].name);
            }
        };

        loadRawData();
    }, []);




    // --- 2. SYNC COM ESTADO GLOBAL ---
    useEffect(() => {
        if (window.projectState) {
            window.projectState.restrictions = restrictions;
            // Compatibilidade legado
            window.projectState.ddl_impo = restrictions
                .filter(r => r.type === 'DDL_IMPO')
                .map(r => ({ name: r.name, group: r.group, params: r.params }));
        }
    }, [restrictions]);

    // --- HELPERS DE NOME ÚNICO (CORE) ---
    
    // Gera um nome único baseado em um prefixo (ex: 'BC_Group' ou 'BC_Group_Copy')
    const generateUniqueName = (baseName, excludeId = null) => {
        let candidate = baseName;
        let counter = 1;
        
        // Verifica se o nome já existe na lista (excluindo o próprio ID se estiver editando)
        const nameExists = (name) => restrictions.some(r => r.name === name && r.id !== excludeId);

        // Se o nome base já existe ou é vazio, começa a adicionar sufixos
        if (baseName.trim() === '' || nameExists(candidate)) {
            // Remove sufixos numéricos anteriores para evitar BC_1_1_1
            const cleanBase = baseName.replace(/_\d+$/, ''); 
            candidate = `${cleanBase}_${counter}`;
            while (nameExists(candidate)) {
                counter++;
                candidate = `${cleanBase}_${counter}`;
            }
        }
        return candidate;
    };

    // --- HANDLERS ---

    const handleAddRestriction = () => {
        if (!selectedGroup) return;
        const groupInfo = availableGroups.find(g => g.name === selectedGroup);
        if (!groupInfo) return;

        const config = LOGIC_MAPPING[groupInfo.category] || LOGIC_MAPPING['1D'];
        const baseName = `BC_${selectedGroup}`;
        
        const newRest = {
            id: Date.now(),
            name: generateUniqueName(baseName), // Garante unicidade na criação
            type: config.type,
            group: selectedGroup,
            params: {}
        };
        
        setRestrictions([...restrictions, newRest]);
    };

    const handleCopyRestriction = (originalRest) => {
        const newName = generateUniqueName(`${originalRest.name}_copy`);
        
        const copy = {
            ...originalRest,
            id: Date.now(),
            name: newName,
            // Copia profunda dos params para evitar referência cruzada
            params: { ...originalRest.params } 
        };

        setRestrictions([...restrictions, copy]);
    };

    const handleDelete = (id) => {
        setRestrictions(prev => prev.filter(r => r.id !== id));
    };

    // Atualiza enquanto digita (permite duplicado visualmente temporário)
    const handleNameChange = (id, val) => {
        setRestrictions(prev => prev.map(r => r.id === id ? { ...r, name: val } : r));
    };

    // VALIDAÇÃO RÍGIDA AO SAIR DO CAMPO (BLINDAGEM)
    const handleNameBlur = (id, currentName) => {
        const isDuplicate = restrictions.some(r => r.name === currentName && r.id !== id);
        const isEmpty = currentName.trim() === '';

        if (isDuplicate || isEmpty) {
            // Se for duplicado ou vazio, força um novo nome único imediatamente
            const safeName = generateUniqueName(isEmpty ? `BC_Constraint` : currentName, id);
            
            setRestrictions(prev => prev.map(r => 
                r.id === id ? { ...r, name: safeName } : r
            ));
        }
    };

    const updateParam = (id, paramKey, value) => {
        setRestrictions(prev => prev.map(r => {
            if (r.id !== id) return r;
            const newParams = { ...r.params };
            
            if (value === '' || value === null || value === undefined) {
                delete newParams[paramKey];
            } else {
                newParams[paramKey] = value;
            }
            return { ...r, params: newParams };
        }));
    };

    const toggleFix = (id, paramKey) => {
        const currentRest = restrictions.find(r => r.id === id);
        if (!currentRest) return;
        const currentVal = currentRest.params[paramKey];
        updateParam(id, paramKey, (currentVal !== undefined) ? '' : "0.0");
    };

    // --- RENDER HELPERS ---
    const getGroupIcon = (cat) => {
        if (cat === '2D') return '⬛';
        if (cat === '1D') return '📏';
        return '📍';
    };

    const activeGroupInfo = availableGroups.find(g => g.name === selectedGroup);
    const currentGroupRestrictions = restrictions.filter(r => r.group === selectedGroup);
    const activeLogic = activeGroupInfo ? (LOGIC_MAPPING[activeGroupInfo.category] || LOGIC_MAPPING['1D']) : null;

    return (
        <div className="flex h-full w-full bg-slate-950 text-slate-200 text-sm overflow-hidden font-sans">
            
            {/* SIDEBAR */}
            <div className="w-60 border-r border-slate-800 bg-slate-950 flex flex-col shrink-0">
                <div className="h-10 border-b border-slate-800 flex items-center px-4 bg-slate-950/50">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Target Groups</span>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
                    {availableGroups.map((grp) => {
                        const count = restrictions.filter(r => r.group === grp.name).length;
                        const isSelected = selectedGroup === grp.name;
                        
                        return (
                            <div 
                                key={grp.name} 
                                onClick={() => setSelectedGroup(grp.name)}
                                className={`flex justify-between items-center px-3 py-2.5 rounded cursor-pointer border-l-2 transition-all ${
                                    isSelected 
                                    ? 'bg-slate-900 border-blue-500 text-white' 
                                    : 'bg-transparent border-transparent hover:bg-slate-900/50 text-slate-400'
                                }`}
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="opacity-70 text-xs">{getGroupIcon(grp.category)}</span>
                                    <span className={`text-xs truncate ${isSelected ? 'font-bold' : 'font-medium'}`}>{grp.name}</span>
                                </div>
                                {count > 0 && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-900/30 text-blue-400 rounded-full">
                                        {count}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ÁREA PRINCIPAL */}
            <div className="flex-1 flex flex-col bg-slate-900">
                
                {activeGroupInfo ? (
                    <>
                        {/* HEADER */}
                        <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded border border-slate-700">
                                    {getGroupIcon(activeGroupInfo.category)}
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white leading-none">{activeGroupInfo.name}</h2>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[9px] text-blue-400 font-mono font-bold uppercase tracking-wider">{activeLogic.label}</span>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={handleAddRestriction}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2"
                            >
                                <span>+</span> Add Constraint
                            </button>
                        </div>

                        {/* LISTA */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-900">
                            {currentGroupRestrictions.length === 0 ? (
                                <div className="h-40 flex flex-col items-center justify-center text-slate-600 opacity-60 border-2 border-dashed border-slate-800 rounded-lg m-4">
                                    <span className="text-2xl mb-2">⚓</span>
                                    <p className="text-xs">No constraints. Group is free.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {currentGroupRestrictions.map((rest) => {
                                        const fields = activeLogic.fields;
                                        // Verifica duplicidade apenas visualmente enquanto edita
                                        const isDuplicate = restrictions.some(r => r.name === rest.name && r.id !== rest.id);


// Arquivo: prosolve/RestrictionConfig.js

return (
    <div key={rest.id} className="bg-slate-950 border border-slate-800 rounded px-3 py-2 flex items-center gap-3 hover:border-slate-700 transition-colors shadow-sm group w-full">
        
        {/* 1. NOME (Um pouco mais largo para ler melhor) */}
        <div className="w-40 shrink-0 relative">
            <input 
                type="text" 
                className={`w-full bg-slate-900/50 border-b text-xs font-bold text-slate-200 outline-none px-1 py-1 transition-all ${isDuplicate ? 'border-red-500/80 text-red-200' : 'border-transparent hover:border-slate-600 focus:border-blue-500'}`}
                value={rest.name} 
                onChange={(e) => handleNameChange(rest.id, e.target.value)} 
                onBlur={(e) => handleNameBlur(rest.id, e.target.value)}
                placeholder="Condition Name"
                title="Must be unique" 
            />
            {isDuplicate && <span className="absolute right-0 top-1 text-[8px] text-red-500 font-bold animate-pulse">!</span>}
        </div>

        {/* 2. DIVISOR */}
        <div className="w-px h-6 bg-slate-800"></div>

        {/* 3. GRID DE CAMPOS (Largura aumentada: min-w-[70px]) */}
        <div className="flex-1 flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            {fields.map(field => {
                const val = rest.params[field];
                const isDefined = val !== undefined;
                const isSpecial = field === 'DNOR' || field === 'DTAN';

                return (
                    <div key={field} className={`flex items-center gap-2 px-2 py-1 rounded border min-w-[70px] transition-all ${isDefined ? 'bg-blue-900/10 border-blue-500/30' : 'bg-slate-900 border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-600'}`}>
                        <button onClick={() => toggleFix(rest.id, field)} className={`text-[9px] font-bold uppercase w-6 text-left ${isSpecial ? 'text-purple-400' : 'text-slate-500'}`} title={isDefined ? "Click to Free" : "Click to Fix"}>{field}</button>
                        
                        {isDefined ? (
                            <input 
                                type="text" 
                                className="w-12 bg-transparent text-right text-[10px] font-mono text-white outline-none border-b border-blue-500/30 focus:border-blue-400 p-0 placeholder-slate-700"
                                value={val} 
                                placeholder="0.0" 
                                onChange={(e) => updateParam(rest.id, field, e.target.value)} 
                            />
                        ) : (
                            <span onClick={() => toggleFix(rest.id, field)} className="text-[9px] text-slate-600 cursor-pointer w-12 text-right select-none hover:text-slate-400">Free</span>
                        )}
                    </div>
                );
            })}
        </div>

        {/* 4. AÇÕES */}
        <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
            <button onClick={() => handleCopyRestriction(rest)} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors" title="Duplicate">❐</button>
            <button onClick={() => handleDelete(rest.id)} className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors" title="Delete">✕</button>
        </div>
    </div>
);




                                    })}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-900">
                        <p className="text-sm">Select a group to start</p>
                    </div>
                )}
            </div>
        </div>
    );
};

window.RestrictionConfig = RestrictionConfig;