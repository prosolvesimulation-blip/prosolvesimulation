// =========================================================
// ARQUIVO: LoadCaseConfig.js
// PATH: prosolve/LoadCaseConfig.js
// =========================================================

const React = window.React || require('react');
const { useState, useEffect } = React;

const LoadCaseConfig = () => {
    const [loadCases, setLoadCases] = useState([]);
    const [availRestrictions, setAvailRestrictions] = useState([]);
    const [availLoads, setAvailLoads] = useState([]);

    // --- 1. CARREGAR DADOS GLOBAIS ---
    useEffect(() => {
        // Carrega o que foi definido nas abas anteriores
        const r = window.projectState?.restrictions || [];
        const l = window.projectState?.loads || [];
        
        setAvailRestrictions(r);
        setAvailLoads(l);

        // Carrega casos salvos ou inicia vazio
        const savedCases = window.projectState?.load_cases || [];
        setLoadCases(savedCases);
    }, []);

    // --- 2. SYNC GLOBAL ---
    useEffect(() => {
        if (window.projectState) {
            window.projectState.load_cases = loadCases;
        }
    }, [loadCases]);

    // --- HANDLERS ---

    const handleAddCase = () => {
        const id = Date.now();
        const num = loadCases.length + 1;
        const newCase = {
            id: id,
            name: `Case_${num}`,
            restrictions: [], // Array de nomes (strings)
            loads: []         // Array de nomes (strings)
        };
        setLoadCases([...loadCases, newCase]);
    };

    const handleDelete = (id) => {
        if (confirm("Delete this Load Case?")) {
            setLoadCases(prev => prev.filter(lc => lc.id !== id));
        }
    };

    const handleNameChange = (id, val) => {
        setLoadCases(prev => prev.map(lc => lc.id === id ? { ...lc, name: val } : lc));
    };

    // Toggle Genérico: Adiciona ou remove o NOME da lista
    const toggleItem = (caseId, listType, itemName) => {
        setLoadCases(prev => prev.map(lc => {
            if (lc.id !== caseId) return lc;

            const currentList = lc[listType] || [];
            const exists = currentList.includes(itemName);

            let newList;
            if (exists) {
                newList = currentList.filter(n => n !== itemName);
            } else {
                newList = [...currentList, itemName];
            }

            return { ...lc, [listType]: newList };
        }));
    };

    // --- RENDER ---

    return (
        <div className="flex flex-col h-full w-full bg-slate-950 text-slate-200 text-sm font-sans border-t border-slate-900">
            
            {/* HEADER */}
            <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded border border-slate-700 text-xl">📚</div>
                    <div>
                        <h2 className="text-sm font-bold text-white leading-none">Load Cases</h2>
                        <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">Analysis Scenarios (MECA_STATIQUE)</span>
                    </div>
                </div>
                <button onClick={handleAddCase} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded text-xs font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2">
                    <span>+</span> New Case
                </button>
            </div>

            {/* TABELA DE CASOS */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-900">
                
                {loadCases.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-600 opacity-60 border-2 border-dashed border-slate-800 rounded-xl">
                        <span className="text-4xl mb-2">📭</span>
                        <p className="text-xs">No Load Cases defined.</p>
                        <p className="text-[10px] mt-1">Combine restrictions and loads here.</p>
                    </div>
                ) : (
                    <div className="space-y-4 max-w-6xl mx-auto">
                        
                        {/* CABEÇALHOS VISUAIS DAS COLUNAS (Estilo Tabela do seu desenho) */}
                        <div className="flex gap-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            <div className="w-40">Case Name</div>
                            <div className="flex-1 border-l border-slate-800 pl-4">Active Restrictions (Boundary Conditions)</div>
                            <div className="flex-1 border-l border-slate-800 pl-4">Active Loads</div>
                            <div className="w-8"></div>
                        </div>

                        {loadCases.map((lc) => (
                            <div key={lc.id} className="flex gap-4 bg-slate-950 border border-slate-800 rounded-lg p-3 hover:border-slate-700 transition-all items-stretch shadow-md">
                                
                                {/* 1. NOME DO CASO */}
                                <div className="w-40 flex flex-col justify-center shrink-0">
                                    <input 
                                        type="text" 
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs font-bold text-white focus:border-blue-500 outline-none"
                                        value={lc.name}
                                        onChange={(e) => handleNameChange(lc.id, e.target.value)}
                                        placeholder="Case Name"
                                    />
                                </div>

                                {/* 2. COLUNA RESTRIÇÕES */}
                                <div className="flex-1 border-l border-slate-800 pl-4 flex flex-col justify-center">
                                    {availRestrictions.length === 0 && <span className="text-[9px] text-slate-600 italic">No restrictions available</span>}
                                    <div className="flex flex-wrap gap-2">
                                        {availRestrictions.map(r => {
                                            const isActive = lc.restrictions.includes(r.name);
                                            return (
                                                <button 
                                                    key={r.id}
                                                    onClick={() => toggleItem(lc.id, 'restrictions', r.name)}
                                                    className={`
                                                        px-2 py-1 rounded border text-[10px] font-bold transition-all flex items-center gap-1
                                                        ${isActive 
                                                            ? 'bg-blue-600 border-blue-500 text-white shadow-sm' 
                                                            : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'}
                                                    `}
                                                    title={`Group: ${r.group}`}
                                                >
                                                    <span className="opacity-70 text-[8px]">📍</span>
                                                    {r.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 3. COLUNA CARGAS */}
                                <div className="flex-1 border-l border-slate-800 pl-4 flex flex-col justify-center">
                                    {availLoads.length === 0 && <span className="text-[9px] text-slate-600 italic">No loads available</span>}
                                    <div className="flex flex-wrap gap-2">
                                        {availLoads.map(l => {
                                            const isActive = lc.loads.includes(l.name);
                                            // Cor diferente para Cargas (Roxo/Laranja)
                                            return (
                                                <button 
                                                    key={l.id}
                                                    onClick={() => toggleItem(lc.id, 'loads', l.name)}
                                                    className={`
                                                        px-2 py-1 rounded border text-[10px] font-bold transition-all flex items-center gap-1
                                                        ${isActive 
                                                            ? 'bg-purple-600 border-purple-500 text-white shadow-sm' 
                                                            : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'}
                                                    `}
                                                    title={`Group: ${l.group}`}
                                                >
                                                    <span className="opacity-70 text-[8px]">{l.type === 'PESANTEUR' ? '🍎' : '⚡'}</span>
                                                    {l.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 4. DELETE */}
                                <div className="w-8 flex items-center justify-center border-l border-slate-800 pl-2">
                                    <button 
                                        onClick={() => handleDelete(lc.id)}
                                        className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                        title="Delete Case"
                                    >
                                        ✕
                                    </button>
                                </div>

                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

window.LoadCaseConfig = LoadCaseConfig;