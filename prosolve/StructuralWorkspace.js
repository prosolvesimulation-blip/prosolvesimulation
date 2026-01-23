const { useState, useEffect } = React;

// API Configuration
const API_BASE = 'http://localhost:5000/api';

// GLOBAL STATE MANAGER - Shared across all components
window.projectState = window.projectState || {
    simulationStatus: {
        Geometry: { ready: false, files: [] },
        Mesh: { ready: false, files: [] },
        Config: { ready: false, files: [] },
        PostPro: { ready: false, files: [] }
    },
    projectPath: null,
    geometries: [],
    materials: [],           // Definições (DEFI_MATERIAU)
    material_assignments: [], // Atribuições (AFFE_MATERIAU)    

    updateSimulationStatus: function (newStatus) {
        this.simulationStatus = newStatus;
        // Trigger update on all listeners
        window.dispatchEvent(new Event('projectStateChanged'));
    }
};




// --- CLASSIFICADOR GLOBAL (A FONTE DA VERDADE) ---
window.classifyMeshGroup = (typesObj) => {
    if (!typesObj) return '3D'; // Segurança
    const types = Object.keys(typesObj);
    
    // 1. Prioridade absoluta para Node (vindo do inspect_mesh.j2)
    if (types.includes('Node')) return 'Node'; 
    
    // 2. Classificação de Elementos
    if (types.some(t => t.includes('HEXA') || t.includes('TETRA') || t.includes('PENTA'))) return '3D';
    if (types.some(t => t.includes('QUAD') || t.includes('TRIA'))) return '2D';
    if (types.some(t => t.includes('SEG'))) return '1D';
    if (types.some(t => t === 'Point' || t === 'POINT')) return 'Point';
    
    return '3D'; // Fallback
};



// COMPONENT: Simulation Console
const SimulationConsole = ({ status, logs }) => {
    if (status === 'IDLE' && !logs) return null;

    return (
        <div className="mt-8 space-y-4 animate-in slide-in-from-bottom duration-500 bg-slate-900 border-t border-slate-800 p-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm uppercase font-bold text-slate-400 tracking-widest flex items-center gap-2">
                    <span> Simulation Console</span>
                    {status === 'RUNNING' && <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>}
                </h3>
                <div className="text-xs font-mono text-slate-500">
                    Status: <span className={
                        status === 'SUCCESS' ? 'text-green-500' :
                            status === 'FAILED' ? 'text-red-500' :
                                'text-blue-400'
                    }>{status}</span>
                </div>
            </div>

            <div className="bg-black/80 rounded-lg border border-slate-700 p-4 font-mono text-xs overflow-hidden shadow-2xl">
                <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 space-y-1">
                    {logs ? (
                        logs.split('\n').map((line, i) => (
                            <div key={i} className={`${line.includes('<F>') || line.includes('ERR') ? 'text-red-400' :
                                line.includes('<W>') ? 'text-amber-400' :
                                    line.includes('<S>') ? 'text-green-400' :
                                        'text-slate-300'
                                }`}>
                                <span className="text-slate-600 mr-2 opacity-50">[{i + 1}]</span>
                                {line}
                            </div>
                        ))
                    ) : (
                        <div className="text-slate-600 italic">Initializing Code_Aster engine...</div>
                    )}
                </div>
            </div>
        </div>
    );
};


function SimConfigPanel({ onRunSimulation }) {
    const [activeTab, setActiveTab] = useState('Mesh');
    const [meshFiles, setMeshFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // --- ESTADOS PARA SALVAMENTO ---
    const [autoSave, setAutoSave] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);

    const ModelConfigComponent = window.ModelConfig;
    const tabs = ['Mesh', 'Model', 'Materials', 'Geometry', 'Restrictions', 'Loads', 'Load Cases'];

    // Listen for global state changes
    useEffect(() => {
        const handleStateChange = () => {
            const meshData = window.projectState?.simulationStatus?.Mesh?.files || [];
            setMeshFiles(meshData);
        };
        window.addEventListener('projectStateChanged', handleStateChange);
        // Initial state load
        handleStateChange();
        return () => window.removeEventListener('projectStateChanged', handleStateChange);
    }, []);




// --- FUNÇÃO SAVE PROJECT (O CONSTRUTOR DO JSON) ---
    const handleSaveProject = async () => {
        const projectPath = window.projectState.projectPath;
        if (!projectPath) {
            alert("Please select a project folder first.");
            return;
        }

        setIsSaving(true);
        const state = window.projectState;
        
        // Helper para limpar nomes (Code_Aster não gosta de espaços)
        const sanitize = (str) => str.trim().replace(/\s+/g, '_').toUpperCase();
        
        // Helper para converter string numérica em float
        const toFloat = (val) => parseFloat(val) || 0.0;

        try {
            // =========================================================
            // 1. PRE-PROCESS (MALHA)
            // =========================================================
            const meshFiles = state.simulationStatus.Mesh.files || [];
            const lireBlock = meshFiles.map((file, idx) => ({
                name: `MESH_${idx+1}`,
                filename: file,
                format: "MED"
            }));

            // =========================================================
            // 2. MODELO (FÍSICA)
            // =========================================================
            // Filtra 'Node' e 'Point' pois não entram no AFFE_MODELE
            const modelItems = (state.geometries || [])
                .filter(g => g.category !== 'Node' && g.category !== 'Point')
                .map(g => {
                    let modelisation = '3D';
                    if (g.category === '1D') modelisation = 'POU_D_T'; // Viga Timoshenko padrão
                    if (g.category === '2D') modelisation = 'DKT';     // Casca DKT padrão
                    
                    return {
                        GROUP_MA: g.group,
                        PHENOMENE: 'MECANIQUE',
                        MODELISATION: modelisation
                    };
                });

            // =========================================================
            // 3. CARACTERÍSTICAS ELEMENTARES (GEOMETRIA)
            // =========================================================
            const caraItems = [];
            
            // 3.1 VIGAS (1D)
            const beams = (state.geometries || []).filter(g => g.category === '1D');
            if (beams.length > 0) {
                beams.forEach(b => {
                    // Aqui passamos os parâmetros brutos. O Python vai calcular as propriedades (Area, Inercia)
                    // usando a lib sectionproperties se necessário, ou passaremos direto se for simples.
                    // Para simplificar agora, passamos a definição da seção.
                    caraItems.push({
                        TYPE: 'POUTRE',
                        GROUP_MA: b.group,
                        SECTION: 'RECTANGLE', // Simplificação: assumindo retangular por enquanto
                        CARA: ['HY', 'HZ'],
                        VALE: [toFloat(b.section_params?.hy || 0.1), toFloat(b.section_params?.hz || 0.1)],
                        ANGL_VRIL: toFloat(b.section_params?.rotation || 0.0)
                    });
                    // TODO: Implementar orientação (VECTEUR Y)
                });
            }

            // 3.2 CASCAS (2D)
            const shells = (state.geometries || []).filter(g => g.category === '2D');
            if (shells.length > 0) {
                shells.forEach(s => {
                    caraItems.push({
                        TYPE: 'COQUE',
                        GROUP_MA: s.group,
                        EPAIS: toFloat(s.section_params?.thickness || 0.01),
                        VECTEUR: [
                            toFloat(s.section_params?.vx || 1), 
                            toFloat(s.section_params?.vy || 0), 
                            toFloat(s.section_params?.vz || 0)
                        ],
                        EXCENTREMENT: toFloat(s.section_params?.offset || 0.0)
                    });
                });
            }

            // =========================================================
            // 4. MATERIAIS
            // =========================================================
            const defiMatBlock = (state.materials || []).map(m => ({
                NAME: sanitize(m.name),
                ELAS: {
                    E: toFloat(m.props.E),
                    NU: toFloat(m.props.NU),
                    RHO: toFloat(m.props.RHO)
                }
            }));

            const affeMatItems = (state.material_assignments || []).map(a => ({
                GROUP_MA: a.group,
                MATER: sanitize(a.material)
            }));

            // =========================================================
            // 5. CARGAS E RESTRIÇÕES (CHARGES)
            // =========================================================
            const chargesBlock = [];

            // 5.1 Restrições (DDL_IMPO)
            // Agrupa por nome da condição para criar blocos coesos
            const restrictions = state.restrictions || [];
            restrictions.forEach(r => {
                const params = {};
                // Mapeia inputs para floats, ignora vazios
                ['DX','DY','DZ','DRX','DRY','DRZ'].forEach(k => {
                    if (r.params[k] !== undefined) params[k] = toFloat(r.params[k]);
                });
                
                if (Object.keys(params).length > 0) {
                    chargesBlock.push({
                        NAME: sanitize(r.name),
                        TYPE: r.type, // 'DDL_IMPO', 'ARETE_IMPO'...
                        GROUP: r.group,
                        PARAMS: params
                    });
                }
            });

            // 5.2 Cargas (Loads)
            const loads = state.loads || [];
            loads.forEach(l => {
                const params = {};
                
                if (l.type === 'PESANTEUR') {
                    params.GRAVITE = toFloat(l.params.GRAV);
                    params.DIRECTION = [toFloat(l.params.DX), toFloat(l.params.DY), toFloat(l.params.DZ)];
                } 
                else if (l.type === 'FORCE_NODALE') {
                    // INTELIGÊNCIA 1: Força Nodal Total
                    // Se o usuário inseriu uma força total, dividimos pelo número de nós do grupo
                    const nodeCount = state.meshAnalysis?.[l.group]?.count || 1;
                    
                    ['FX','FY','FZ','MX','MY','MZ'].forEach(k => {
                        if (l.params[k]) params[k] = toFloat(l.params[k]) / nodeCount;
                    });
                }
                else if (l.type === 'FORCE_COQUE') {
                    // INTELIGÊNCIA 2: Força na Face (Pressão Equivalente)
                    // Aqui marcamos como CALC para o Python resolver a área
                    // Mas salvamos os dados brutos
                    ['FX','FY','FZ'].forEach(k => {
                        if (l.params[k]) params[k] = toFloat(l.params[k]);
                    });
                }
                else if (l.type === 'PRES_REP') {
                     if (l.params.PRES) params.PRES = toFloat(l.params.PRES);
                }
                else {
                     // Genérico (Beam Forces etc)
                     Object.keys(l.params).forEach(k => params[k] = toFloat(l.params[k]));
                }

                chargesBlock.push({
                    NAME: sanitize(l.name),
                    TYPE: l.type, // FORCE_NODALE, FORCE_COQUE...
                    GROUP: l.group,
                    PARAMS: params,
                    _META: { type: 'LOAD' } // Marcador para facilitar debug
                });
            });

            // =========================================================
            // 6. SOLVER (MECA_STATIQUE)
            // =========================================================
            const solverBlock = (state.load_cases || []).map(lc => {
                // Junta IDs de restrições e cargas
                const excitNames = [...lc.restrictions, ...lc.loads].map(name => sanitize(name));
                
                return {
                    RESULTAT: `RESU_${sanitize(lc.name)}`,
                    EXCIT: excitNames.map(n => ({ CHARGE: n }))
                };
            });

            // =========================================================
            // 7. PÓS-PROCESSAMENTO
            // =========================================================
            // Gera lista de resultados para exportar
            const outputResults = (state.load_cases || []).map(lc => ({
                RESULTAT: `RESU_${sanitize(lc.name)}`,
                NOM_CHAM: ['DEPL', 'SIEQ_ELNO', 'REAC_NODA', 'FORC_NODA']
            }));
            
            // TODO: Adicionar lógica de camadas (SUP/INF) aqui se houver Shells

            // =========================================================
            // CONSOLIDAÇÃO FINAL (O PAYLOAD)
            // =========================================================
            const projectJson = {
                meta: {
                    generated_by: "ProSolve_Studio",
                    date: new Date().toISOString()
                },
                LIRE_MAILLAGE: lireBlock,
                ASSE_MAILLAGE: [{ OPERATION: 'SUPERPOSE', RESULTAT: 'MAIL' }], // Simplificado
                AFFE_MODELE: { MAILLAGE: 'MAIL', AFFE: modelItems },
                AFFE_CARA_ELEM: { MODELE: 'MODELE', ...caraItems }, // Precisa formatar melhor no builder python
                // Para simplificar o envio, mandamos arrays separados e o Python junta
                _CARA_ELEM_DATA: caraItems, 
                
                DEFI_MATERIAU: defiMatBlock,
                AFFE_MATERIAU: { MAILLAGE: 'MAIL', AFFE: affeMatItems },
                
                CHARGES: chargesBlock,
                
                MECA_STATIQUE: solverBlock,
                
                POST_PROCESS: {
                    IMPR_RESU: {
                        FORMAT: 'MED',
                        UNITE: 80,
                        RESU: outputResults
                    },
                    // Solicita exportação CSV das reações para todos os casos
                    EXPORT_REACTIONS: true 
                }
            };

            // Envio para o Backend (Salvar em disco)
            // Aqui usamos um endpoint genérico save_file ou o endpoint específico da simulação
            // Vamos simular enviando para o endpoint de scan por enquanto, ou criar um novo.
            // O ideal é salvar isso como 'project.json' na pasta do projeto.
            
            /* 
            // COMENTADO: Chamada real à API quando o backend tiver o endpoint /save_project
            await fetch(`${API_BASE}/save_project`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    folder_path: projectPath, 
                    filename: 'project.json',
                    content: projectJson 
                })
            });
            */
           
            // Por enquanto, loga no console para verificarmos a estrutura
            console.log("🔥 [PROJECT.JSON GENERATED] 🔥");
            console.log(JSON.stringify(projectJson, null, 2));
            
            setLastSaved(new Date().toLocaleTimeString());

        } catch (e) {
            console.error("Save Error:", e);
            alert("Failed to build project data: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };




    return (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/*<h1 className="text-2xl font-light mb-6 border-b border-slate-800 pb-4">Simulation Configuration</h1>*/}

            {/* --- BARRA DE FERRAMENTAS (ABAS + BOTÕES) --- */}
            <div className="flex border-b border-slate-800 mb-6 items-center justify-between gap-4 pb-0">
                
                {/* Abas (Esquerda) */}
                <div className="flex overflow-x-auto no-scrollbar">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === tab
                                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Botões de Ação (Direita) */}
                <div className="flex items-center gap-3 bg-slate-900/50 pl-4 py-1 rounded-l-lg">
                    
                    {/* Status Info */}
                    <div className="text-[10px] text-slate-500 text-right mr-2 leading-tight hidden xl:block">
                        {isSaving ? <span className="text-blue-400 animate-pulse">Saving...</span> : 
                         lastSaved ? <span>Saved: {lastSaved}</span> : 
                         <span>Unsaved</span>}
                    </div>

                    {/* Auto Save Toggle */}
                    <div 
                        className="flex items-center gap-2 cursor-pointer group select-none mr-2" 
                        onClick={() => setAutoSave(!autoSave)}
                        title="Toggle Auto-Save"
                    >
                        <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${autoSave ? 'bg-emerald-600' : 'bg-slate-600'}`}>
                            <div className={`w-3 h-3 bg-white rounded-full shadow transition-transform ${autoSave ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${autoSave ? 'text-emerald-500' : 'text-slate-500'}`}>Auto</span>
                    </div>

                    {/* Save Project Button */}
                    <button
                        onClick={handleSaveProject}
                        disabled={isSaving}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded flex items-center gap-2 transition-colors border border-slate-600 shadow-sm active:scale-95"
                    >
                        <span>💾</span> SAVE PROJECT
                    </button>

                    {/* Run Button */}
                    <button
                        onClick={onRunSimulation}
                        className="mr-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-lg shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center gap-2 group active:scale-95 border border-emerald-400/30"
                    >
                        <span className="group-hover:rotate-12 transition-transform">🚀</span>
                        RUN CODE_ASTER
                    </button>
                </div>
            </div>

            {/* Conteúdo das Abas */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'Mesh' && (
                    <div className="space-y-6">
                        <div className={`p-6 rounded-xl border-2 ${meshFiles?.length > 0
                            ? 'border-green-500 bg-green-500/10'
                            : 'border-amber-500 bg-amber-500/10'
                            }`}>
                            <div className="flex items-center gap-4">
                                <span className="text-3xl">{meshFiles?.length > 0 ? '✅' : '⚠️'}</span>
                                <div>
                                    <h3 className="font-bold text-lg">Mesh Files</h3>
                                    <p className="text-slate-300">
                                        {loading ? 'Scanning...' : meshFiles?.length > 0
                                            ? `Found ${meshFiles.length} mesh file(s)`
                                            : 'No Mesh Files Found'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {meshFiles?.length > 0 && (
                            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                                <h4 className="font-bold mb-4">Detected Mesh Files</h4>
                                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                                    {meshFiles.map((file, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-3 bg-slate-700/50 rounded border border-slate-600 hover:bg-slate-600/50 transition-colors">
                                            <span className="text-lg">📋</span>
                                            <span className="text-slate-200 text-sm font-mono">{file}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'Model' && ModelConfigComponent && (
                    <ModelConfigComponent 
                        meshFiles={meshFiles}
                    />
                )}

                {activeTab === 'Materials' && window.MaterialConfig && (
                    <window.MaterialConfig />
                )}


            {activeTab === 'Geometry' && (
                // APENAS UM CONTAINER QUE OCUPA TUDO (h-full w-full)
                // O componente interno GeometryConfig gerencia sua própria largura (flex-1 vs flex-2)
                <div className="h-full w-full animate-in fade-in duration-500">
                    {window.GeometryConfig ? (
                        <window.GeometryConfig />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-red-400 p-4 text-center">
                            <p className="font-bold">GeometryConfig not loaded</p>
                        </div>
                    )}
                </div>
            )}



                {activeTab === 'Restrictions' && (
                    <div className="h-full w-full animate-in fade-in duration-500">
                        {window.RestrictionConfig ? (
                            <window.RestrictionConfig />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <span className="text-4xl mb-4">⚠️</span>
                                <p>RestrictionConfig.js not loaded.</p>
                                <p className="text-xs mt-2">Check structural.html script tags.</p>
                            </div>
                        )}
                    </div>
                )}



                {activeTab === 'Loads' && (
                    <div className="h-full w-full animate-in fade-in duration-500">
                        {window.LoadConfig ? (
                            <window.LoadConfig />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <span className="text-4xl mb-4">⚠️</span>
                                <p>LoadConfig.js not loaded.</p>
                            </div>
                        )}
                    </div>
                )}



               {activeTab === 'Load Cases' && (
                    <div className="h-full w-full animate-in fade-in duration-500">
                        {window.LoadCaseConfig ? (
                            <window.LoadCaseConfig />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <span className="text-4xl mb-4">⚠️</span>
                                <p>LoadCaseConfig.js not loaded.</p>
                            </div>
                        )}
                    </div>
                )}



            </div>
        </div>
    );
}


function StructuralApp({ onBack, onToggleMaximize, projectPath, setProjectPath }) {
    const [activeView, setActiveView] = useState('Workflow');

    // Global Simulation State
    const [simStatus, setSimStatus] = useState('IDLE');
    const [simLogs, setSimLogs] = useState('');
    const [isPolling, setIsPolling] = useState(false);
    // Estado para controlar a visibilidade do console
    const [showConsole, setShowConsole] = useState(true);   

    // EFFECT: Polling logs if running
    useEffect(() => {
        let pollInterval;

        if (isPolling && projectPath) {
            console.log("[Global Polling] Starting log polling...");
            pollInterval = setInterval(async () => {
                try {
                    const response = await fetch(`${API_BASE}/get_logs`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ folder_path: projectPath })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        setSimLogs(data.logs);
                        setSimStatus(data.status);

                        if (data.status === 'SUCCESS' || data.status === 'FAILED') {
                            console.log(`[Global Polling] Simulation ended with status: ${data.status}`);
                            setIsPolling(false);
                            // Force update global status for badges
                            window.simStatus = data.status; // Quick hack for shared state
                            window.dispatchEvent(new Event('simStatusChanged'));
                        }
                    }
                } catch (error) {
                    console.error("[Global Polling] Error fetching logs:", error);
                }
            }, 3000); // Poll every 3 seconds
        }

        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [isPolling, projectPath]);

    // Listener for workflow triggering simulation
    useEffect(() => {
        const handleStartSim = () => {
            console.log("[Workspace] Simulation started from workflow!");
            setSimStatus('RUNNING');
            setIsPolling(true);
        };
        window.addEventListener('startSimulation', handleStartSim);
        return () => window.removeEventListener('startSimulation', handleStartSim);
    }, []);



// FUNCTION: Launch External Tools
    const handleLaunch = async (toolName) => {
        console.log(`[Workspace] Attempting to launch: ${toolName}`);
        
        try {
            const response = await fetch(`${API_BASE}/launch_tool`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tool_name: toolName })
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                console.log(`✅ ${toolName} launched successfully`);
            } else {
                console.error(`❌ Failed to launch ${toolName}:`, result.message);
                alert(`Error launching ${toolName}: ${result.message}`);
            }
        } catch (error) {
            console.error(`❌ Network error launching ${toolName}:`, error);
            alert(`Could not connect to backend to launch ${toolName}. Check if main.pyw is running.`);
        }
    };




    const handleRunSimulation = async () => {
        if (!projectPath) return;

        console.log("Manual run triggered");
        // We re-scan to trigger the exact same pipeline in main.pyw
        try {
            await fetch(`${API_BASE}/scan_workspace`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder_path: projectPath })
            });
            // Trigger polling manually since we are the caller
            setSimStatus('RUNNING');
            setIsPolling(true);
        } catch (e) {
            alert("Error starting simulation: " + e);
        }
    };

    return (
        <div className="flex h-full w-full flex-col bg-slate-900 text-white font-sans overflow-hidden relative">
            {/* Top Bar - Now only containing navigation and module title, buttons handled by Shell */}
            <div className="h-12 bg-slate-950 flex items-center justify-between px-4 drag-region select-none shrink-0 border-b border-slate-800">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="no-drag bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1 rounded border border-slate-700 transition-colors"
                    >
                        ← Back to Suite
                    </button>
                    <span className="font-bold text-sm tracking-wider text-blue-400">STRUCTURAL WORKBENCH</span>
                </div>
                {/* Title bar buttons are now in the dashboard.html Shell */}
                <div className="w-24"></div>
            </div>

            <div className="flex flex-1 overflow-hidden h-full">
                {/* Sidebar */}
                <div className="w-20 bg-slate-950 flex flex-col items-center py-6 border-r border-slate-800 shrink-0">
                    <div
                        onClick={() => setActiveView('Workflow')    }
                        className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors cursor-pointer mb-6 no-drag group relative ${activeView === 'Workflow' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'hover:bg-slate-800 text-slate-500'
                            }`}
                        title="Main Pipeline"
                    >
                        <span className="text-2xl group-hover:scale-110 transition-transform">📋</span>
                        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">Pipeline</div>
                    </div>

                    <div className="w-12 border-t border-slate-800 mb-6"></div>


                    <div
                        onClick={() => setActiveView('SimConfig')   }
                        className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors cursor-pointer mb-4 no-drag group relative ${activeView === 'SimConfig' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'hover:bg-slate-700 text-slate-500'
                            }`}
                        title="Sim Config"
                    >
                        <span className="text-2xl group-hover:scale-110 transition-transform">⚙️</span>
                        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">Sim Config</div>
                    </div>


                    <div onClick={() => handleLaunch('FreeCAD')} className="w-12 h-12 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-colors cursor-pointer mb-4 no-drag group relative" title="FreeCAD">
                        <span className="text-2xl group-hover:scale-110 transition-transform">📐</span>
                        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">FreeCAD</div>
                    </div>

                    <div onClick={() => handleLaunch('Salome')} className="w-12 h-12 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-colors cursor-pointer mb-4 no-drag group relative" title="Salome Meca">
                        <span className="text-2xl group-hover:scale-110 transition-transform">🕸️</span>
                        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">Salome Meca</div>
                    </div>

                    <div onClick={() => handleLaunch('Paraview')} className="w-12 h-12 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-colors cursor-pointer mb-4 no-drag group relative" title="Paraview">
                        <span className="text-2xl group-hover:scale-110 transition-transform">📊</span>
                        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">Paraview</div>
                    </div>
                </div>

                {/* Main Area */}
                <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 pointer-events-auto relative">
                    <div className="flex-1 overflow-y-auto p-8 pointer-events-auto relative">
                        {activeView === 'Workflow' ? (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
                                {/*<h1 className="text-2xl font-light mb-8 border-b border-slate-800 pb-4">Structural Analysis Pipeline</h1>*/}
                                <window.StructuralWorkflow
                                    onProjectChange={(path) => setProjectPath(path)}
                                    externalPath={projectPath}
                                    globalSimStatus={simStatus}
                                />
                            </div>
                        ) : (
                            <div className="pb-20">
                                <SimConfigPanel onRunSimulation={handleRunSimulation} />
                            </div>
                        )}
                    </div>

                    {/* Global Simulation Console - Always Visible at Bottom */}
                    <div className={`shrink-0 z-50 max-h-80 overflow-hidden bg-slate-900 border-t border-slate-800 shadow-2xl transition-all duration-300 ${showConsole ? '' : 'hidden'}`}>
                        <SimulationConsole status={simStatus} logs={simLogs} />
                    </div>
                    
                    {/* Botão de Toggle - Lógica ONCLICK aplicada aqui */}
                    <button 
                        type="button"
                        onClick={() => setShowConsole(!showConsole)}
                        className="absolute bottom-2 right-2 z-50 bg-white/80 backdrop-blur-sm border border-gray-200 hover:bg-gray-100 rounded-lg p-2 shadow-md transition-all cursor-pointer"
                        title={showConsole ? "Hide Console" : "Show Console"}
                    >
                        <div className="flex items-center justify-center w-6 h-6">
                            {/* Ícone muda dependendo se está aberto ou fechado */}
                            <span className="text-gray-700 text-lg font-bold">
                                {showConsole ? '↓' : '↑'}
                            </span>
                        </div>
                    </button>

                </div>
            </div>
        </div>
    );
}

window.StructuralWorkspace = StructuralApp;

// Global exposure
window.StructuralApp = StructuralApp;
