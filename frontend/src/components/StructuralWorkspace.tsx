import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, FolderOpen, Save, Play } from 'lucide-react'
import { motion } from 'framer-motion'
import ModelConfig from './config/ModelConfig'
import MaterialConfig from './config/MaterialConfig'
import RestrictionConfig from './config/RestrictionConfig'
import LoadConfig from './config/LoadConfig'
import GeometryConfig from './config/GeometryConfig'
import LoadCaseConfig from './config/LoadCaseConfig'
import MeshConfig from './config/MeshConfig'
import VtkMeshViewer from './config/VtkMeshViewer'
import VerificationConfig from './config/VerificationConfig'

interface StructuralWorkspaceProps {
    onBack: () => void
    projectPath: string | null
    setProjectPath: (path: string | null) => void
}

type Tab = 'model' | 'mesh' | 'material' | 'geometry' | 'restrictions' | 'loads' | 'loadcases' | '3d-view' | 'verification'

interface ProjectConfig {
    geometries: any[]
    materials: any[]
    restrictions: any[]
    loads: any[]
    load_cases: any[]
    post_elem_mass?: any
    post_releve_t_reactions?: any
}

export default function StructuralWorkspace({
    onBack,
    projectPath,
    setProjectPath,
}: StructuralWorkspaceProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<Tab>('mesh')
    const [projectConfig, setProjectConfig] = useState<ProjectConfig>({
        geometries: [],
        materials: [],
        restrictions: [],
        loads: [],
        load_cases: [],
        post_elem_mass: { mass_calculations: [] },
        post_releve_t_reactions: { reaction_extraction: { enabled: true } }
    })

    // DEBUG LOG
    const [availableGroups, setAvailableGroups] = useState<string[]>([]) // Group names
    const [nodeGroups, setNodeGroups] = useState<string[]>([])
    const [allGroupsData, setAllGroupsData] = useState<any>({}) // Full group metadata
    const [meshFiles, setMeshFiles] = useState<string[]>([])
    const [simulationRunning, setSimulationRunning] = useState(false)
    // Adicione isso junto com os outros estados (ex: logo abaixo de meshFiles)
    const [vtkGeometries, setVtkGeometries] = useState<any[]>([])

    // CONSOLIDATION PROTOCOL: Mesh DNA Pipeline Smart Consumer (Multi-Mesh)
    useEffect(() => {
        if (projectPath && meshFiles.length > 0) {
            const medFiles = meshFiles.filter(f => f.toLowerCase().endsWith('.med'))
            console.log(`[MeshDNA] Multi-Mesh Protocol: Detected ${medFiles.length} files.`)

            medFiles.forEach(file => {
                // If not already in global state or if it's a new session
                fetchMeshDNA(file)
            })
        }
    }, [projectPath, meshFiles])

    const fetchMeshDNA = async (fileName: string) => {
        try {
            // Telemetry: Log Port (Protocol)
            const port = window.location.port || '3000' // Frontend port representation
            console.log(`[MeshDNA] Fetching from Port: ${port}`)

            const res = await fetch('/api/mesh_dna', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_path: `${projectPath}\\${fileName}` })
            })
            const result = await res.json()

            if (result.status === 'success') {
                const groups = result.data.groups

                // Telemetry: Filtered Log (Protocol)
                console.log(`[MeshDNA] Groups Received from ${fileName}:`, Object.keys(groups))

                // Update Independent Global State (Protocol)
                const globalWindow = window as any
                if (!globalWindow.projectState) globalWindow.projectState = {}
                if (!globalWindow.projectState.meshes) globalWindow.projectState.meshes = {}

                // Store mesh data independently by filename
                globalWindow.projectState.meshes[fileName] = result.data

                // Update Independent Local UI States
                setAllGroupsData((prev: any) => ({
                    ...prev,
                    [fileName]: groups
                }))

                // 🌟 Update Flat States for Tabs (Accumulation)
                const newGroupNames = Object.keys(groups)
                setAvailableGroups(prev => Array.from(new Set([...prev, ...newGroupNames])))

                const newNodes = newGroupNames.filter(name => groups[name].category === 'Node')
                setNodeGroups(prev => Array.from(new Set([...prev, ...newNodes])))

                // Event Dispatch (Protocol)
                window.dispatchEvent(new Event('meshDataLoaded'))
            }
        } catch (error) {
            console.error("[MeshDNA] Fetch failed:", error)
        }
    }



    useEffect(() => {
        if (activeTab === '3d-view' && projectPath) {

            // Define função interna assíncrona para garantir a ordem (1 -> 2)
            const runVtkSequence = async () => {
                try {
                    // PASSO 1: Manda gerar e ESPERA (await) o backend responder
                    const resGen = await fetch('/api/vtk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ project_path: projectPath })
                    });

                    if (!resGen.ok) {
                        console.error('[VTK] Erro na geração:', resGen.statusText);
                        return; // Para se der erro na geração
                    }

                    // PASSO 2: Busca os dados (Só executa depois que o passo 1 acabou)
                    const resData = await fetch('/api/get_vtk_geometry', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ folder_path: projectPath })
                    });

                    const json = await resData.json();

                    // PASSO 3: Guarda no Estado
                    if (json.status === 'success') {
                        console.log("📦 [PARENT] Dados prontos para entrega:", json.data);
                        setVtkGeometries(json.data);
                    }

                } catch (err) {
                    console.error('[VTK] Erro na sequência:', err);
                }
            };

            runVtkSequence();
        }
    }, [activeTab, projectPath])


    const handleRunSimulation = async () => {
        if (!projectPath) return
        setSimulationRunning(true)
        try {
            // Auto save first? Maybe safer to ask user to save, but let's assume Save Project flow handles generation.
            // We should ideally save first to ensure export is fresh.
            await handleSaveProject()

            const res = await fetch('/api/run_simulation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder_path: projectPath })
            })
            const data = await res.json()

            if (data.status === 'success') {
                alert('Simulation Completed!\nCheck "simulation_files/message" for details.')
            } else {
                alert('Simulation Failed:\n' + data.message)
            }
        } catch (error) {
            console.error(error)
            alert('Error running simulation')
        } finally {
            setSimulationRunning(false)
        }
    }

    const handleSaveProject = async () => {
        if (!projectPath) return
        try {
            console.log("Saving project...")

            const response = await fetch('/api/save_project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folder_path: projectPath,
                    config: {
                        ...projectConfig,
                        meshes: meshFiles.map(f => ({
                            name: f.split('.')[0].replace(/[- ]/g, '_'),
                            filename: f
                        }))
                    }
                })
            })
            const data = await response.json()
            if (data.status === 'success') {
                alert("Project Saved & Generated Successfully!")
            } else {
                alert("Save Failed: " + data.message)
            }
        } catch (e) {
            console.error(e)
            alert("Error saving project")
        }
    }

    // Memoized update handlers to prevent infinite loops and DATA LOSS (Persistence Fix)
    const updateGeometries = useCallback((updatedGeos: any[]) => {
        setProjectConfig(prev => {
            // Identify which domains (categories) this update represents
            const currentDomains = new Set(updatedGeos.map(g => g._category).filter(Boolean))

            // If empty (e.g., initial load or deletion), we might need to be careful.
            // But typical logic is: if update covers 1D/2D, we replace 1D/2D and KEEP 3D/0D.
            const preserved = prev.geometries.filter(g => !currentDomains.has(g._category))

            return {
                ...prev,
                geometries: [...preserved, ...updatedGeos]
            }
        })
    }, [])

    const updateMaterials = useCallback((materials: any[]) => {
        setProjectConfig(prev => ({ ...prev, materials }))
    }, [])

    const updateRestrictions = useCallback((restrictions: any[]) => {
        setProjectConfig(prev => ({ ...prev, restrictions }))
    }, [])

    const updateLoads = useCallback((loads: any[]) => {
        setProjectConfig(prev => ({ ...prev, loads }))
    }, [])

    const updateLoadCases = useCallback((cases: any[]) => {
        setProjectConfig(prev => ({ ...prev, load_cases: cases }))
    }, [])


    const handleOpenFolder = async () => {
        try {
            setIsLoading(true)
            const response = await fetch('/api/open_folder_dialog')
            const data = await response.json()

            if (data.status === 'success' && data.path) {
                setProjectPath(data.path)
                setMeshFiles([]) // 🛡️ CRITICAL: Clear old files immediately to prevent Race Condition (Error 400)

                // Try load config, but start with empty if not found
                setProjectConfig({
                    geometries: [],
                    materials: [],
                    restrictions: [],
                    loads: [],
                    load_cases: []
                })

                // 2. Trigger Scan & Inspection
                // This will generate mesh.json, export.export and RUN inspect_mesh.py -> mesh_groups.json
                setIsLoading(true)
                const scanResp = await fetch('/api/scan_workspace', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folder_path: data.path })
                })
                const scanData = await scanResp.json()

                // 3. Read the generated groups (and list files from scanData)
                if (scanData.status === 'success') {
                    if (scanData.files && scanData.files.mesh) {
                        setMeshFiles(scanData.files.mesh)
                    } else {
                        setMeshFiles([])
                    }

                    const groupsResp = await fetch('/api/read_mesh_groups', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ folder_path: data.path })
                    })
                    const groupsData = await groupsResp.json()

                    if (groupsData.status === 'success' && groupsData.data && groupsData.data.groups) {
                        const allGroups = groupsData.data.groups
                        const groupNames = Object.keys(allGroups)

                        // 🛡️ DATA PROTECTION: DNA protocol is now the source of truth for allGroupsData.
                        // We do NOT overwrite it with potentially empty legacy scan results.
                        // setAllGroupsData(allGroups)
                        // setAvailableGroups(groupNames)

                        // Categorize
                        const nodes = groupNames.filter(n => allGroups[n].type === 'node')
                        // setNodeGroups(nodes)

                        console.log("ROOT: Groups centralized (DNA-only mode):", { nodes, allCount: groupNames.length })

                        // ALWAYS refresh geometries when groups are loaded
                        setProjectConfig(prev => {
                            const newGeos = groupNames
                                .filter(g => allGroups[g].type !== 'node')
                                .map(g => {
                                    const existing = prev.geometries.find(ex => ex.group === g)
                                    if (existing) return existing

                                    return {
                                        group: g,
                                        type: '3D',
                                        phenomenon: 'MECANIQUE',
                                        _category: '3D'
                                    }
                                })
                            return { ...prev, geometries: newGeos }
                        })
                    }
                }
            }
        } catch (error) {
            console.error('Failed to open folder:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const tabs = [
        { id: 'mesh' as Tab, label: 'Mesh', icon: '🕸️' },
        { id: 'model' as Tab, label: 'Model', icon: '🏗️' },
        { id: 'geometry' as Tab, label: 'Geometry', icon: '📐' },
        { id: '3d-view' as Tab, label: '3D View', icon: '🧊' },
        { id: 'material' as Tab, label: 'Material', icon: '⚙️' },
        { id: 'restrictions' as Tab, label: 'Restrictions', icon: '🔒' },
        { id: 'loads' as Tab, label: 'Loads', icon: '⚡' },
        { id: 'loadcases' as Tab, label: 'Load Cases', icon: '📊' },
        { id: 'verification' as Tab, label: 'Verification', icon: '✅' }
    ]

    return (
        <div className="h-full w-full flex flex-col bg-slate-950 font-sans">
            {/* Toolbar */}
            <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-3 shrink-0">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors uppercase text-[10px] font-black tracking-widest"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Terminal</span>
                </motion.button>

                <div className="h-8 w-px bg-slate-800" />

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleOpenFolder}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 border border-cyan-400 text-slate-950 font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
                >
                    <FolderOpen className="w-4 h-4" />
                    <span>
                        {isLoading ? 'Scanning...' : 'Open Project'}
                    </span>
                </motion.button>

                {projectPath && (
                    <>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSaveProject}
                            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 text-slate-950 font-black text-[10px] uppercase tracking-widest transition-all"
                        >
                            <Save className="w-4 h-4" />
                            <span>Save Project</span>
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleRunSimulation}
                            disabled={simulationRunning}
                            className={`flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-500 border border-orange-400 text-slate-950 font-black text-[10px] uppercase tracking-widest transition-all ${simulationRunning ? 'opacity-50' : ''}`}
                        >
                            <Play className="w-4 h-4" />
                            <span>
                                {simulationRunning ? 'Job_Running...' : 'Run Simulation'}
                            </span>
                        </motion.button>
                    </>
                )}

                {projectPath && (
                    <div className="ml-auto flex items-center gap-4">
                        <div className="h-8 w-[1px] bg-slate-800" />
                        <div className="text-[10px] text-slate-500 font-mono tracking-tighter truncate max-w-md uppercase italic">
                            PATH: {projectPath}
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {!projectPath ? (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-40">
                        <FolderOpen className="w-20 h-20 text-slate-700 mb-6" />
                        <h2 className="text-sm font-black text-slate-600 uppercase tracking-[0.4em] mb-2">
                            Null_Workspace_Detected
                        </h2>
                        <p className="text-[10px] font-mono text-slate-700 text-center max-w-sm">
                            Initiate project sequence. Load a workspace containing MED topology.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Tab Navigation (Sidebar) */}
                        <div className="w-52 bg-slate-900 border-r border-slate-800 flex flex-col">
                            <div className="p-4 border-b border-slate-800 bg-slate-950/40">
                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none">Modules_Selection</span>
                            </div>
                            <div className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`
                                            w-full flex items-center gap-3 px-4 py-3 transition-all border
                                            ${activeTab === tab.id
                                                ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-[inset_0_0_20px_rgba(34,211,238,0.05)]'
                                                : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                                            }`}
                                    >
                                        <span className={`text-lg grayscale brightness-50 contrast-125 ${activeTab === tab.id ? 'grayscale-0 brightness-100' : ''}`}>{tab.icon}</span>
                                        <span className="font-black text-[10px] uppercase tracking-widest">{tab.label}</span>
                                        {activeTab === tab.id && (
                                            <div className="ml-auto w-1 h-3 bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                                        )}
                                    </button>
                                ))}
                            </div>
                            <div className="p-4 border-t border-slate-800 bg-slate-950/40">
                                <span className="text-[9px] font-mono text-slate-700 uppercase tracking-tighter">ProSolve_Core_v.0.9</span>
                            </div>
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-hidden bg-slate-950">
                            {activeTab === 'model' && (
                                <ModelConfig
                                    key={projectPath}
                                    projectPath={projectPath}
                                    meshGroups={allGroupsData}
                                    currentGeometries={projectConfig.geometries}
                                    onUpdate={updateGeometries}
                                />
                            )}
                            {activeTab === 'mesh' && (
                                <MeshConfig
                                    key={projectPath}
                                    projectPath={projectPath}
                                    meshes={meshFiles}
                                />
                            )}
                            {activeTab === 'material' && (
                                <MaterialConfig
                                    key={projectPath}
                                    projectPath={projectPath}
                                    availableGroups={availableGroups}
                                    nodeGroups={nodeGroups}
                                    initialMaterials={projectConfig.materials}
                                    onUpdate={updateMaterials}
                                />
                            )}

                            {activeTab === 'geometry' && (
                                <GeometryConfig
                                    key={projectPath}
                                    projectPath={projectPath}
                                    meshGroups={allGroupsData}
                                    availableGeometries={projectConfig.geometries}
                                    onUpdate={updateGeometries}
                                />
                            )}

                            {activeTab === '3d-view' && (
                                <VtkMeshViewer
                                    projectPath={projectPath}
                                    meshKey={Date.now()}
                                    geometries={vtkGeometries}
                                />
                            )}

                            {activeTab === 'restrictions' && (
                                <RestrictionConfig
                                    key={projectPath}
                                    projectPath={projectPath}
                                    availableGroups={nodeGroups.length > 0 ? nodeGroups : availableGroups} // Prefer node groups
                                    initialRestrictions={projectConfig.restrictions}
                                    onUpdate={updateRestrictions}
                                />
                            )}
                            {activeTab === 'loads' && (
                                <LoadConfig
                                    key={projectPath}
                                    projectPath={projectPath}
                                    availableGroups={availableGroups}
                                    initialLoads={projectConfig.loads}
                                    onUpdate={updateLoads}
                                />
                            )}
                            {activeTab === 'loadcases' && (
                                <LoadCaseConfig
                                    key={projectPath}
                                    projectPath={projectPath}
                                    availableLoads={projectConfig.loads}
                                    availableRestrictions={projectConfig.restrictions}
                                    availableGroups={availableGroups}
                                    initialLoadCases={projectConfig.load_cases}
                                    onUpdate={updateLoadCases}
                                />
                            )}
                            {activeTab === 'verification' && (
                                <VerificationConfig
                                    key={projectPath}
                                    projectPath={projectPath}
                                    config={{
                                        mass: projectConfig.post_elem_mass,
                                        reactions: projectConfig.post_releve_t_reactions
                                    }}
                                    onUpdate={(type, data) => {
                                        setProjectConfig(prev => ({
                                            ...prev,
                                            [type === 'mass' ? 'post_elem_mass' : 'post_releve_t_reactions']: data
                                        }))
                                    }}
                                />
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
