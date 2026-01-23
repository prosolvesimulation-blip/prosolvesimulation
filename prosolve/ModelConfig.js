const { useState, useEffect } = React;

function ModelConfig() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Opções baseadas no PDF do Code_Aster
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
    };

    const projectPath = window.projectState?.projectPath;

    // --- SYNC COM O ESTADO GLOBAL ---
    // Sempre que 'groups' mudar, atualizamos o objeto global que o botão "Save Project" vai ler
    useEffect(() => {
        if (groups.length > 0) {
            // Formata para o padrão esperado pelo backend (geometry.json)
            const exportData = groups
                .filter(g => g.selected)
                .map(g => ({
                    group: g.name,
                    type: g.model,
                    formulation: (g.model === 'DKT' || g.model === 'DST') ? g.model : undefined,
                    phenomenon: 'MECANIQUE',
                    // Metadados extras úteis para UI futura
                    _category: g.category 
                }));
            
            // Atualiza global
            window.projectState.geometries = exportData;
            console.log("[ModelConfig] Synced to global state:", exportData.length, "items");
        }
    }, [groups]);

    // --- CARREGAMENTO INICIAL ---
    useEffect(() => {
        if (projectPath) {
            loadMeshGroups();
        }
    }, [projectPath]);

    const detectCategory = (typesObj) => {
        const types = Object.keys(typesObj);
        if (types.some(t => t === 'Node')) return 'Node'; 
        if (types.some(t => t.includes('HEXA') || t.includes('TETRA') || t.includes('PENTA'))) return '3D';
        if (types.some(t => t.includes('QUAD') || t.includes('TRIA'))) return '2D';
        if (types.some(t => t.includes('SEG'))) return '1D';
        return '3D';
    };

    const detectDefaultModel = (category) => {
         if (category === 'Node') return 'Node';
        if (category === '3D') return '3D';
        if (category === '2D') return 'DKT';
        if (category === '1D') return 'POU_D_T';
        return '3D';
    };


const loadMeshGroups = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('http://localhost:5000/api/read_mesh_groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder_path: projectPath })
            });

            const result = await response.json();
            if (result.status === 'error') throw new Error(result.message);

            const data = result.data;

            if(window.projectState) {
                window.projectState.meshAnalysis = data.groups;
            }


            const loadedGroups = [];
            
            // --- LÓGICA DE PERSISTÊNCIA ---
            // Recupera o que já foi salvo anteriormente no estado global
            const savedGeometries = window.projectState?.geometries || [];
            const hasSavedData = savedGeometries.length > 0;

            if (data && data.groups) {
                Object.entries(data.groups).forEach(([groupName, info]) => {
                    const category = detectCategory(info.types);
                    const compStr = Object.entries(info.types)
                        .map(([t, q]) => `${t}:${q}`)
                        .join(', ');

                    // Verifica se este grupo já existe no estado salvo
                    const savedGroup = savedGeometries.find(g => g.group === groupName);

                    // Determina se está selecionado e qual modelo usar
                    // Se temos dados salvos:
                    //   - Se o grupo está no salvo -> Selecionado = true, Modelo = salvo
                    //   - Se o grupo NÃO está no salvo -> Selecionado = false (usuário desmarcou antes)
                    // Se NÃO temos dados salvos (primeira vez) -> Selecionado = true, Modelo = Auto Detect
                    
                    let isSelected = true;
                    let modelToUse = detectDefaultModel(category);

                    if (hasSavedData) {
                        if (savedGroup) {
                            isSelected = true;
                            modelToUse = savedGroup.type; // Recupera a escolha do usuário (ex: Beam em vez de Truss)
                        } else {
                            isSelected = false;
                        }
                    }

                    loadedGroups.push({
                        name: groupName,
                        selected: isSelected,
                        count: info.count,
                        composition: compStr,
                        category: category, 
                        model: modelToUse, 
                        phenomenon: 'MECANIQUE'        
                    });
                });
            }
            setGroups(loadedGroups);
        } catch (err) {
            if(!err.message.includes("não encontrado")) console.error(err);
            setError("No inspection data found. Run MESH analysis first.");
        } finally {
            setLoading(false);
        }
    };    


    // --- HANDLERS ---
    const handleCheckboxChange = (index) => {
        const newGroups = [...groups];
        newGroups[index].selected = !newGroups[index].selected;
        setGroups(newGroups);
    };

    const handleModelChange = (index, newModel) => {
        const newGroups = [...groups];
        newGroups[index].model = newModel;
        setGroups(newGroups);
    };

    const toggleAll = (select) => {
        const newGroups = groups.map(g => ({ ...g, selected: select }));
        setGroups(newGroups);
    };

    // --- RENDER ---
    if (!projectPath) return <div className="p-10 text-center text-slate-500">Please select a project.</div>;

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64 text-blue-400 animate-pulse">
            <div className="text-4xl mb-2">📡</div>
            <p>Loading Mesh Data...</p>
        </div>
    );

    if (error || groups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-10 text-slate-400">
                <div className="text-4xl mb-4 text-slate-600">🕸️</div>
                <h3 className="text-xl font-bold text-slate-300 mb-2">No Mesh Groups Detected</h3>
                <p className="mb-6 text-center max-w-md text-sm">{error}</p>
                <button 
                    onClick={loadMeshGroups}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors border border-slate-600 text-sm"
                >
                    Refresh Data
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full max-w-7xl mx-auto animate-in fade-in duration-500 p-2">
            
            {/* Header / Selection Tools (Local) */}
            <div className="flex justify-start items-center mb-4 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                <div className="flex gap-2">
                    <button onClick={() => toggleAll(true)} className="px-3 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-slate-200 transition-colors">
                        Check All
                    </button>
                    <button onClick={() => toggleAll(false)} className="px-3 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-slate-200 transition-colors">
                        Uncheck All
                    </button>
                </div>
                <div className="ml-auto text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                    Model Definition
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden shadow-xl flex-1 flex flex-col">
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-3 w-12 text-center border-b border-slate-800">Sel.</th>
                                <th className="p-3 w-1/4 border-b border-slate-800">Group Name</th>
                                <th className="p-3 w-1/4 border-b border-slate-800">Composition</th>
                                <th className="p-3 w-1/4 border-b border-slate-800">Model Definition (Code_Aster)</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-700/50 text-sm">
                            {groups.map((group, idx) => {  // <--- 1. ABRE CHAVES AQUI
                                
                                // Se for Nó, esconde (retorna null)
                                if (group.category === 'Node' || group.category === 'Point') return null;

                                // 2. ADICIONE O 'return (' ANTES DO TR
                                return (
                                    <tr key={idx} className={`transition-colors hover:bg-slate-700/30 ${!group.selected ? 'opacity-50 grayscale-[50%]' : ''}`}>
                                        
                                        {/* Checkbox */}
                                        <td className="p-3 text-center">
                                            <input 
                                                type="checkbox" 
                                                checked={group.selected} 
                                                onChange={() => handleCheckboxChange(idx)}
                                                className="w-4 h-4 rounded border-slate-500 bg-slate-700 accent-blue-600 cursor-pointer"
                                            />
                                        </td>

                                        {/* Name */}
                                        <td className="p-3 font-mono font-medium text-blue-300">
                                            {group.name}
                                        </td>

                                        {/* Composition */}
                                        <td className="p-3 text-xs text-slate-400 font-mono">
                                            {group.composition}
                                        </td>

                                        {/* Filtered Selector */}
                                        <td className="p-3">
                                            <select 
                                                value={group.model} 
                                                onChange={(e) => handleModelChange(idx, e.target.value)}
                                                disabled={!group.selected}
                                                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-slate-200 text-xs focus:ring-1 focus:ring-blue-500 outline-none disabled:cursor-not-allowed transition-colors hover:border-slate-500"
                                            >
                                                {group.category === '3D' && (
                                                    <optgroup label="Volume (3D)">
                                                        {MODEL_OPTIONS['3D'].map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                                                    </optgroup>
                                                )}

                                                {group.category === '2D' && (
                                                    <optgroup label="Plate / Shell (2D)">
                                                        {MODEL_OPTIONS['2D'].map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                                                    </optgroup>
                                                )}

                                                {group.category === '1D' && (
                                                    <optgroup label="Beam / Truss (1D)">
                                                        {MODEL_OPTIONS['1D'].map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                                                    </optgroup>
                                                )}
                                            </select>
                                        </td>

                                    </tr>
                                ); // <--- 3. FECHA OS PARENTESES DO RETURN
                            })} {/* <--- 4. FECHA AS CHAVES E O MAP */}
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
    );
}

// Export global
window.ModelConfig = ModelConfig;