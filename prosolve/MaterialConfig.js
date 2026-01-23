const { useState, useEffect, useCallback } = React;

function MaterialConfig() {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Biblioteca de Materiais Pré-definidos
    const MATERIAL_LIBRARY = {
        'Steel': {
            E: 210000000000.0, // 210 GPa
            NU: 0.3,
            RHO: 7850.0,
            ALPHA: 1.2e-5
        },
        'Aluminium': {
            E: 70000000000.0, // 70 GPa
            NU: 0.33,
            RHO: 2700.0,
            ALPHA: 2.3e-5
        },
        'Concrete': {
            E: 30000000000.0, // 30 GPa
            NU: 0.2,
            RHO: 2400.0,
            ALPHA: 1.0e-5
        },
        'Titanium': {
            E: 116000000000.0,
            NU: 0.32,
            RHO: 4500.0,
            ALPHA: 0.86e-5
        },
        'Glass': {
            E: 70000000000.0,
            NU: 0.22,
            RHO: 2500.0,
            ALPHA: 0.9e-5
        }
    };

    // Pega os grupos da aba anterior (Model)
    const projectPath = window.projectState?.projectPath;
    const geometryGroups = window.projectState?.geometries || [];

    // --- INICIALIZAÇÃO ---
    useEffect(() => {
        if (projectPath) {
            initializeMaterials();
        }
    }, [projectPath, geometryGroups]);

    const initializeMaterials = () => {
        setLoading(true);
        
        // 1. Recupera atribuições salvas (Quem usa o quê + PROPRIEDADES salvas)
        const savedAssignments = window.projectState?.material_assignments || [];
        
        let initialData = [];

        if (geometryGroups.length > 0) {
            initialData = geometryGroups
                .filter(geo => geo._category !== 'Node' && geo._category !== 'Point') // <--- FILTRO NOVO
                .map(geo => {
                const existing = savedAssignments.find(m => m.group === geo.group);
                
                if (existing) {
                    const matName = existing.material || 'Steel';
                    
                    // Lógica de Persistência Robusta:
                    // Se existirem propriedades salvas no objeto de atribuição, usa elas.
                    // Se não (primeira vez ou legado), pega da biblioteca.
                    const recoveredProps = existing.props ? { ...existing.props } : 
                                           (MATERIAL_LIBRARY[matName] ? { ...MATERIAL_LIBRARY[matName] } : { ...MATERIAL_LIBRARY['Steel'] });

                    return { 
                        group: geo.group,
                        materialName: matName,
                        props: recoveredProps, 
                        selected: true 
                    };
                } else {
                    // Novo grupo (ainda não configurado): Padrão Steel
                    return {
                        group: geo.group,
                        materialName: 'Steel',
                        props: { ...MATERIAL_LIBRARY['Steel'] },
                        selected: true
                    };
                }
            });
        }
        
        setAssignments(initialData);
        setLoading(false);
    };   

    // --- SYNC COM ESTADO GLOBAL ---
    // Atualiza o projectState sempre que houver mudanças
    useEffect(() => {
        if (assignments.length > 0) {
            // 1. Lista de Atribuições (Salva PROPS aqui para garantir persistência exata por grupo)
            const exportAssignments = assignments
                .filter(a => a.selected)
                .map(a => ({
                    group: a.group,
                    material: a.materialName,
                    props: a.props // Salva os valores editados
                }));

            // 2. Lista de Definições Únicas (Para o gerador .comm do Code_Aster)
            const uniqueMaterials = [];
            
            assignments.filter(a => a.selected).forEach(a => {
                const existingIndex = uniqueMaterials.findIndex(m => m.name === a.materialName);
                
                // Converte props para números reais antes de enviar para o Aster (limpa strings temporárias)
                const cleanProps = {};
                Object.keys(a.props).forEach(k => {
                    const val = parseFloat(a.props[k]);
                    cleanProps[k] = isNaN(val) ? 0.0 : val;
                });

                if (existingIndex === -1) {
                    uniqueMaterials.push({
                        name: a.materialName,
                        props: cleanProps
                    });
                } else {
                    // Se já existe, mantemos o primeiro. 
                    // (Em uma versão futura, poderíamos criar materiais Steel_1, Steel_2 se as props forem diferentes)
                    uniqueMaterials[existingIndex].props = cleanProps;
                }
            });

            // Atualiza estado global
            window.projectState.materials = uniqueMaterials;
            window.projectState.material_assignments = exportAssignments; 
        }
    }, [assignments]);

    // --- HANDLERS ---

    const handleMaterialSelect = (index, matName) => {
        const newAssignments = [...assignments];
        newAssignments[index].materialName = matName;
        // Carrega as propriedades do preset se disponível
        if (matName !== 'Custom' && MATERIAL_LIBRARY[matName]) {
             newAssignments[index].props = { ...MATERIAL_LIBRARY[matName] };
        }
        setAssignments(newAssignments);
    };

    const handlePropChange = (index, propKey, rawValue) => {
        const newAssignments = [...assignments];
        
        // 1. Permite limpar o campo (string vazia)
        if (rawValue === '') {
            newAssignments[index].props[propKey] = '';
            setAssignments(newAssignments);
            return;
        }

        // 2. Troca vírgula por ponto (compatibilidade PT-BR)
        let cleanValue = rawValue.replace(',', '.');

        // 3. Validação: Só aceita se for numérico ou parte válida de um número em construção
        // Permite: "0", "0.", "-5", "1e", "1e-"
        if (!isNaN(cleanValue) || cleanValue === '-' || cleanValue.endsWith('.') || cleanValue.toLowerCase().endsWith('e') || cleanValue.toLowerCase().endsWith('e-')) {
            newAssignments[index].props[propKey] = cleanValue;
            setAssignments(newAssignments);
        }
    };

    const applyToAll = (sourceIndex) => {
        const sourceMat = assignments[sourceIndex];
        const newAssignments = assignments.map(a => ({
            ...a,
            materialName: sourceMat.materialName,
            props: { ...sourceMat.props }
        }));
        setAssignments(newAssignments);
    };

    // --- RENDER ---

    if (loading) return <div className="text-center p-10 text-blue-400">Loading Materials...</div>;

    if (assignments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-10 text-slate-400">
                <div className="text-4xl mb-4 text-slate-600">🧪</div>
                <h3 className="text-xl font-bold text-slate-300 mb-2">No Groups Defined</h3>
                <p className="text-sm text-center mb-4">Please go to the <strong>Model</strong> tab and define your element groups first.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full max-w-[95%] mx-auto animate-in fade-in duration-500 p-2">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-4 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-400 font-medium">
                    <span className="text-blue-400 font-bold">Tip:</span> Use <strong>DOTS (.)</strong> for decimals. Values in SI Units (Pa, kg/m³, K⁻¹).
                </div>
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                    Material Definition (DEFI_MATERIAU)
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden shadow-xl flex-1 flex flex-col">
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-3 border-b border-slate-800 w-48">Group Name</th>
                                <th className="p-3 border-b border-slate-800 w-40">Material Preset</th>
                                <th className="p-3 border-b border-slate-800 text-center w-32" title="Young's Modulus (Pa)">E (Pa)</th>
                                <th className="p-3 border-b border-slate-800 text-center w-24" title="Poisson Ratio">NU</th>
                                <th className="p-3 border-b border-slate-800 text-center w-28" title="Density (kg/m³)">RHO (kg/m³)</th>
                                <th className="p-3 border-b border-slate-800 text-center w-28" title="Thermal Expansion">ALPHA (K⁻¹)</th>
                                <th className="p-3 border-b border-slate-800 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50 text-sm">
                            {assignments.map((item, idx) => (
                                <tr key={idx} className="transition-colors hover:bg-slate-700/30">
                                    
                                    {/* Group Name (Read Only) */}
                                    <td className="p-3 font-mono font-medium text-slate-300 truncate max-w-[200px]" title={item.group}>
                                        {item.group}
                                    </td>

                                    {/* Material Selector */}
                                    <td className="p-3">
                                        <select 
                                            value={item.materialName} 
                                            onChange={(e) => handleMaterialSelect(idx, e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-blue-300 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-bold"
                                        >
                                            {Object.keys(MATERIAL_LIBRARY).map(mat => (
                                                <option key={mat} value={mat}>{mat}</option>
                                            ))}
                                            <option value="Custom">Custom</option>
                                        </select>
                                    </td>

                                    {/* Properties Inputs - Type TEXT to allow free typing */}
                                    <td className="p-2">
                                        <input 
                                            type="text" 
                                            value={item.props.E}
                                            onChange={(e) => handlePropChange(idx, 'E', e.target.value)}
                                            className="w-full bg-slate-900/50 border border-slate-600/50 rounded px-2 py-1 text-slate-200 text-xs text-right focus:border-blue-500 outline-none font-mono"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input 
                                            type="text" 
                                            value={item.props.NU}
                                            onChange={(e) => handlePropChange(idx, 'NU', e.target.value)}
                                            className="w-full bg-slate-900/50 border border-slate-600/50 rounded px-2 py-1 text-slate-200 text-xs text-right focus:border-blue-500 outline-none font-mono"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input 
                                            type="text" 
                                            value={item.props.RHO}
                                            onChange={(e) => handlePropChange(idx, 'RHO', e.target.value)}
                                            className="w-full bg-slate-900/50 border border-slate-600/50 rounded px-2 py-1 text-slate-200 text-xs text-right focus:border-blue-500 outline-none font-mono"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input 
                                            type="text" 
                                            value={item.props.ALPHA}
                                            onChange={(e) => handlePropChange(idx, 'ALPHA', e.target.value)}
                                            className="w-full bg-slate-900/50 border border-slate-600/50 rounded px-2 py-1 text-slate-200 text-xs text-right focus:border-blue-500 outline-none font-mono"
                                        />
                                    </td>

                                    {/* Actions */}
                                    <td className="p-2 text-center">
                                        <button 
                                            onClick={() => applyToAll(idx)}
                                            className="text-[10px] text-slate-500 hover:text-blue-400 underline cursor-pointer"
                                            title="Apply this material to all groups"
                                        >
                                            All
                                        </button>
                                    </td>

                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// Export global
window.MaterialConfig = MaterialConfig;