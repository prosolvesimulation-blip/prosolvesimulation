// =========================================================
// ARQUIVO: LoadConfig.js
// PATH: prosolve/LoadConfig.js
// =========================================================

const React = window.React || require('react');
const { useState, useEffect } = React;

const LoadConfig = () => {
    const [loads, setLoads] = useState([]);
    const [availableGroups, setAvailableGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);

    // --- REGRAS DE NEGÓCIO (Code_Aster) ---
    // Define quais cargas estão disponíveis para cada categoria
    const LOAD_TYPES = {
        'Node': [
            { code: 'FORCE_NODALE', label: 'Nodal Force', icon: '🎯', fields: ['FX', 'FY', 'FZ', 'MX', 'MY', 'MZ'] }
        ],
        '1D': [
            { code: 'FORCE_POUTRE', label: 'Beam Force (Dist.)', icon: '📏', fields: ['FX', 'FY', 'FZ'] },
            { code: 'PESANTEUR', label: 'Gravity', icon: '🍎', fields: ['GRAV', 'DX', 'DY', 'DZ'] }
        ],
        '2D': [
            { code: 'PRES_REP', label: 'Pressure (Normal)', icon: '⬇️', fields: ['PRES'] },
            { code: 'FORCE_COQUE', label: 'Shell Force (Vector)', icon: '💨', fields: ['FX', 'FY', 'FZ'] },
            { code: 'PESANTEUR', label: 'Gravity', icon: '🍎', fields: ['GRAV', 'DX', 'DY', 'DZ'] }
        ]
    };

    // --- 1. CARREGAR E FILTRAR DADOS ---
    useEffect(() => {
        const loadRawData = async () => {
            let rawGroups = {};
            
            // Usa a fonte da verdade global
            if (window.projectState?.meshAnalysis) {
                rawGroups = window.projectState.meshAnalysis;
            } else {
                try {
                    const resp = await fetch('http://localhost:5000/api/read_mesh_groups', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ folder_path: window.projectState?.projectPath })
                    });
                    const json = await resp.json();
                    if (json.status === 'success') rawGroups = json.data.groups;
                } catch (e) { console.error("LoadConfig load error", e); }
            }

            const processedGroups = Object.entries(rawGroups)
                .map(([name, info]) => ({
                    name: name,
                    type: Object.keys(info.types).join(', '),
                    category: window.classifyMeshGroup ? window.classifyMeshGroup(info.types) : '3D'
                }))
                // FILTRO: Loads aplicados em Nós, 1D e 2D. 3D filtrado conforme pedido.
                .filter(g => g.category !== '3D' && g.category !== 'Point'); // Point geralmente é geometry helper

            setAvailableGroups(processedGroups);

            const savedLoads = window.projectState?.loads || [];
            setLoads(savedLoads);

            if (!selectedGroup && processedGroups.length > 0) {
                setSelectedGroup(processedGroups[0].name);
            }
        };

        loadRawData();
    }, []);

    // --- 2. SYNC GLOBAL ---
    useEffect(() => {
        if (window.projectState) {
            window.projectState.loads = loads;
        }
    }, [loads]);

    // --- HELPERS ---
    const generateUniqueName = (baseName, excludeId = null) => {
        let candidate = baseName;
        let counter = 1;
        const nameExists = (name) => loads.some(l => l.name === name && l.id !== excludeId);
        if (baseName.trim() === '' || nameExists(candidate)) {
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
    const handleAddLoad = () => {
        if (!selectedGroup) return;
        const groupInfo = availableGroups.find(g => g.name === selectedGroup);
        if (!groupInfo) return;

        // Pega o primeiro tipo disponível como default
        const availableTypes = LOAD_TYPES[groupInfo.category] || LOAD_TYPES['1D'];
        const defaultType = availableTypes[0];

        const newLoad = {
            id: Date.now(),
            name: generateUniqueName(`Load_${selectedGroup}`),
            type: defaultType.code,
            group: selectedGroup,
            params: {}
        };
        
        // Se for Gravidade, preenche defaults
        if (defaultType.code === 'PESANTEUR') {
            newLoad.params = { GRAV: 9.81, DX: 0, DY: 0, DZ: -1 };
        }

        setLoads([...loads, newLoad]);
    };

    const handleCopyLoad = (original) => {
        const newName = generateUniqueName(`${original.name}_copy`);
        const copy = { ...original, id: Date.now(), name: newName, params: { ...original.params } };
        setLoads([...loads, copy]);
    };

    const handleDelete = (id) => setLoads(prev => prev.filter(l => l.id !== id));
    
    const handleUpdate = (id, field, value) => {
        setLoads(prev => prev.map(l => {
            if (l.id !== id) return l;
            
            // Se mudar o tipo, reseta params (exceto se for mudar para gravidade, ai preenche defaults)
            if (field === 'type') {
                let newParams = {};
                if (value === 'PESANTEUR') newParams = { GRAV: 9.81, DX: 0, DY: 0, DZ: -1 };
                return { ...l, type: value, params: newParams };
            }
            
            return { ...l, [field]: value };
        }));
    };

    const handleNameBlur = (id, currentName) => {
        const isDuplicate = loads.some(l => l.name === currentName && l.id !== id);
        const isEmpty = currentName.trim() === '';
        if (isDuplicate || isEmpty) {
            const safeName = generateUniqueName(isEmpty ? `Load_Case` : currentName, id);
            setLoads(prev => prev.map(l => l.id === id ? { ...l, name: safeName } : l));
        }
    };

    const updateParam = (id, paramKey, value) => {
        setLoads(prev => prev.map(l => {
            if (l.id !== id) return l;
            const newParams = { ...l.params };
            if (value === '' || value === null) delete newParams[paramKey];
            else newParams[paramKey] = value;
            return { ...l, params: newParams };
        }));
    };

    // --- RENDER HELPERS ---
    const getGroupIcon = (cat) => {
        if (cat === '2D') return '⬛';
        if (cat === '1D') return '📏';
        return '📍';
    };

    const activeGroupInfo = availableGroups.find(g => g.name === selectedGroup);
    const currentGroupLoads = loads.filter(l => l.group === selectedGroup);
    
    // Opções de tipos para o grupo atual
    const allowedTypes = activeGroupInfo ? (LOAD_TYPES[activeGroupInfo.category] || []) : [];

    return (
        <div className="flex h-full w-full bg-slate-950 text-slate-200 text-sm overflow-hidden font-sans">
            
            {/* SIDEBAR (Lista de Grupos) */}
            <div className="w-60 border-r border-slate-800 bg-slate-950 flex flex-col shrink-0">
                <div className="h-10 border-b border-slate-800 flex items-center px-4 bg-slate-950/50">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Target Groups</span>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
                    {availableGroups.map((grp) => {
                        const count = loads.filter(l => l.group === grp.name).length;
                        const isSelected = selectedGroup === grp.name;
                        return (
                            <div key={grp.name} onClick={() => setSelectedGroup(grp.name)} className={`flex justify-between items-center px-3 py-2.5 rounded cursor-pointer border-l-2 transition-all ${isSelected ? 'bg-slate-900 border-blue-500 text-white' : 'bg-transparent border-transparent hover:bg-slate-900/50 text-slate-400'}`}>
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="opacity-70 text-xs">{getGroupIcon(grp.category)}</span>
                                    <span className={`text-xs truncate ${isSelected ? 'font-bold' : 'font-medium'}`}>{grp.name}</span>
                                </div>
                                {count > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-900/30 text-blue-400 rounded-full">{count}</span>}
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
                                <div className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded border border-slate-700">{getGroupIcon(activeGroupInfo.category)}</div>
                                <div>
                                    <h2 className="text-sm font-bold text-white leading-none">{activeGroupInfo.name}</h2>
                                    <div className="flex items-center gap-2 mt-0.5"><span className="text-[9px] text-blue-400 font-mono font-bold uppercase tracking-wider">{activeGroupInfo.category} Loads</span></div>
                                </div>
                            </div>
                            <button onClick={handleAddLoad} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2"><span>+</span> Add Load</button>
                        </div>

                        {/* LISTA */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-900">
                            {currentGroupLoads.length === 0 ? (
                                <div className="h-40 flex flex-col items-center justify-center text-slate-600 opacity-60 border-2 border-dashed border-slate-800 rounded-lg m-4">
                                    <span className="text-2xl mb-2">🏋️</span>
                                    <p className="text-xs">No loads applied to this group.</p>
                                </div>
                            ) : (
                                <div className="space-y-2 w-full">
                                    {currentGroupLoads.map((load) => {
                                        const loadDef = allowedTypes.find(t => t.code === load.type) || allowedTypes[0];
                                        const fields = loadDef.fields;
                                        const isDuplicate = loads.some(l => l.name === load.name && l.id !== load.id);

                                        return (
                                            <div key={load.id} className="bg-slate-950 border border-slate-800 rounded px-2 py-1 flex items-center gap-2 hover:border-slate-700 transition-colors shadow-sm group w-full">
                                                
                                                {/* 1. Nome da Carga */}
                                                <div className="w-32 shrink-0 relative">
                                                    <input 
                                                        type="text" 
                                                        className={`w-full bg-slate-900/50 border-b text-xs font-bold text-slate-200 outline-none px-1 py-1 transition-all ${isDuplicate ? 'border-red-500/80 text-red-200' : 'border-transparent hover:border-slate-600 focus:border-blue-500'}`}
                                                        value={load.name} onChange={(e) => handleUpdate(load.id, 'name', e.target.value)} onBlur={(e) => handleNameBlur(load.id, e.target.value)}
                                                        placeholder="Load Name" title="Must be unique" />
                                                    {isDuplicate && <span className="absolute right-0 top-1 text-[8px] text-red-500 font-bold animate-pulse">!</span>}
                                                </div>

                                                {/* 2. Seletor de Tipo (Importante pois aqui pode variar) */}
                                                <div className="w-24 shrink-0">
                                                    <select 
                                                        className="w-full bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-300 rounded py-1 px-1 outline-none focus:border-blue-500"
                                                        value={load.type}
                                                        onChange={(e) => handleUpdate(load.id, 'type', e.target.value)}
                                                    >
                                                        {allowedTypes.map(t => <option key={t.code} value={t.code}>{t.icon} {t.label}</option>)}
                                                    </select>
                                                </div>

                                                {/* 3. Divisor */}
                                                <div className="w-px h-6 bg-slate-800"></div>

                                                {/* 4. Grid de Campos (Slim) */}
                                                <div className="flex-1 flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
                                                    {fields.map(field => {
                                                        const val = load.params[field];
                                                        const isDefined = val !== undefined && val !== null;
                                                        // Destaque visual para GRAVITE ou PRESSAO
                                                        const isMain = field === 'GRAV' || field === 'PRES';

                                                        return (
                                                            <div key={field} className={`flex items-center gap-1 px-1.5 py-1 rounded border min-w-[55px] transition-all ${isDefined ? (isMain ? 'bg-purple-900/20 border-purple-500/30' : 'bg-blue-900/10 border-blue-500/30') : 'bg-slate-900 border-slate-800 opacity-60'}`}>
                                                                <span className={`text-[9px] font-bold uppercase w-5 text-left ${isMain ? 'text-purple-400' : 'text-slate-500'}`}>{field}</span>
                                                                <input type="text" className="w-12 bg-transparent text-right text-[10px] font-mono text-white outline-none border-b border-blue-500/30 focus:border-blue-400 p-0 placeholder-slate-700"
                                                                    value={val || ''} placeholder="-" onChange={(e) => updateParam(load.id, field, e.target.value)} />
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* 5. Ações */}
                                                <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                                                    <button onClick={() => handleCopyLoad(load)} className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors" title="Duplicate">❐</button>
                                                    <button onClick={() => handleDelete(load.id)} className="w-5 h-5 flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors" title="Delete">✕</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-900"><p className="text-sm">Select a group to apply loads</p></div>
                )}
            </div>
        </div>
    );
};

window.LoadConfig = LoadConfig;