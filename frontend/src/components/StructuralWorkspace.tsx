import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, FolderOpen, Save, Play, Box, Grid } from 'lucide-react'
import { motion } from 'framer-motion'
import ModelConfig from './config/ModelConfig'
import MaterialConfig from './config/MaterialConfig'
import RestrictionConfig from './config/RestrictionConfig'
import LoadConfig from './config/LoadConfig'
import GeometryConfig from './config/GeometryConfig'
import LoadCaseConfig from './config/LoadCaseConfig'
import MeshConfig from './config/MeshConfig'
import VtkMeshViewer from './config/VtkMeshViewer'
import PostProcessingTab from './config/PostProcessingTab'
import ReportTab from './config/ReportTab'
import AnalysisConfig from './config/AnalysisConfig'
import ContactConfig from './config/ContactConfig'
import ConnectionConfig from './config/ConnectionsConfig'
import VerificationConfig from './config/VerificationConfig'

interface StructuralWorkspaceProps {
    onBack: () => void
    projectPath: string | null
    setProjectPath: (path: string | null) => void
}

type Tab = 'model' | 'mesh' | 'material' | 'geometry' | 'connections' | 'contact' | 'restrictions' | 'loads' | 'loadcases' | '3d-view' | 'analysis' | 'verification' | 'results' | 'report'

interface ProjectConfig {
    geometries: any[]
    materials: any[]
    restrictions: any[]
    loads: any[]
    load_cases: any[]
    analysis?: any
    contacts?: any[]
    connections?: any[]
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
        analysis: { type: 'STATIQUE', parameters: { time_stepping: 'AUTO', max_iter: 20, precision: 1e-6 } },
        contacts: [],
        connections: [],
        post_elem_mass: { mass_calculations: [] },
        post_releve_t_reactions: { reaction_extraction: { enabled: true } }
    })

    // DEBUG LOG
    const [availableGroups, setAvailableGroups] = useState<string[]>([]) // Group names
    const [nodeGroups, setNodeGroups] = useState<string[]>([])
    const [allGroupsData, setAllGroupsData] = useState<any>({}) // Full group metadata
    const [meshFiles, setMeshFiles] = useState<string[]>([])
    const [simulationRunning, setSimulationRunning] = useState(false)
    const [vtkGeometries, setVtkGeometries] = useState<any[]>([])

    // CONSOLIDATION PROTOCOL: Mesh DNA Pipeline Smart Consumer (Multi-Mesh)
    useEffect(() => {
        if (projectPath && meshFiles.length > 0) {
            const medFiles = meshFiles.filter(f => f.toLowerCase().endsWith('.med'))
            console.log(`[MeshDNA] Multi-Mesh Protocol: Detected ${medFiles.length} files.`)

            medFiles.forEach(file => {
                fetchMeshDNA(file)
            })
        }
    }, [projectPath, meshFiles])

    const fetchMeshDNA = async (fileName: string) => {
        try {
            const port = window.location.port || '3000'
            console.log(`[MeshDNA] Fetching from Port: ${port}`)

            const res = await fetch('/api/mesh_dna', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_path: `${projectPath}\\${fileName}` })
            })
            const result = await res.json()

            if (result.status === 'success') {
                const groups = result.data.groups
                console.log(`[MeshDNA] Groups Received from ${fileName}:`, Object.keys(groups))

                const globalWindow = window as any
                if (!globalWindow.projectState) globalWindow.projectState = {}
                if (!globalWindow.projectState.meshes) globalWindow.projectState.meshes = {}

                globalWindow.projectState.meshes[fileName] = result.data

                setAllGroupsData((prev: any) => ({
                    ...prev,
                    [fileName]: groups
                }))

                const newGroupNames = Object.keys(groups)
                setAvailableGroups(prev => Array.from(new Set([...prev, ...newGroupNames])))

                const newNodes = newGroupNames.filter(name => groups[name].category === 'Node')
                setNodeGroups(prev => Array.from(new Set([...prev, ...newNodes])))

                window.dispatchEvent(new Event('meshDataLoaded'))
            }
        } catch (error) {
            console.error("[MeshDNA] Fetch failed:", error)
        }
    }

    useEffect(() => {
        if (activeTab === '3d-view' && projectPath) {
            const runVtkSequence = async () => {
                try {
                    console.log("[3D] Iniciando geração in-memory...");

                    const res = await fetch('/api/3d/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            project_path: projectPath,
                            geometry_state: projectConfig.geometries
                        })
                    });

                    const json = await res.json();

                    if (json.status === 'success') {
                        console.log("📦 [3D] Geometrias recebidas via stream:", json.data.length);
                        setVtkGeometries(json.data);
                    } else {
                        console.error('[3D] Falha na geração:', json.message);
                    }

                } catch (err) {
                    console.error('[3D] Erro na comunicação com backend:', err);
                }
            };

            runVtkSequence();
        }
    }, [activeTab, projectPath])


    const handleRunSimulation = async () => {
        if (!projectPath) return
        setSimulationRunning(true)
        try {
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

    // Memoized update handlers
    const updateGeometries = useCallback((updatedGeos: any[]) => {
        setProjectConfig(prev => {
            const currentDomains = new Set(updatedGeos.map(g => g._category).filter(Boolean))
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

    const updateAnalysis = useCallback((analysis: any) => {
        setProjectConfig(prev => ({ ...prev, analysis }))
    }, [])

    const updateContacts = useCallback((contacts: any[]) => {
        setProjectConfig(prev => ({ ...prev, contacts }))
    }, [])

    const updateConnections = useCallback((connections: any[]) => {
        setProjectConfig(prev => ({ ...prev, connections }))
    }, [])

    const updateVerification = useCallback((type: 'mass' | 'reactions', data: any) => {
        setProjectConfig(prev => {
            if (type === 'mass') return { ...prev, post_elem_mass: data }
            return { ...prev, post_releve_t_reactions: data }
        })
    }, [])


    const handleOpenFolder = async () => {
        try {
            setIsLoading(true)
            const response = await fetch('/api/open_folder_dialog')
            const data = await response.json()

            if (data.status === 'success' && data.path) {
                setProjectPath(data.path)
                setMeshFiles([])

                setProjectConfig({
                    geometries: [],
                    materials: [],
                    restrictions: [],
                    loads: [],
                    load_cases: [],
                    analysis: { type: 'STATIQUE', parameters: { time_stepping: 'AUTO', max_iter: 20, precision: 1e-6 } },
                    contacts: [],
                    connections: []
                })

                setIsLoading(true)
                const scanResp = await fetch('/api/scan_workspace', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folder_path: data.path })
                })
                const scanData = await scanResp.json()

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

                        // Categorize
                        const nodes = groupNames.filter(n => allGroups[n].type === 'node')
                        console.log("ROOT: Groups centralized (DNA-only mode):", { nodes, allCount: groupNames.length })

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
        { id: 'material' as Tab, label: 'Material', icon: '⚙️' },
        { id: 'geometry' as Tab, label: 'Geometry', icon: '📐' },
        { id: 'connections' as Tab, label: 'Connections', icon: '🕸️' },
        { id: 'contact' as Tab, label: 'Contact', icon: '🔗' },
        { id: 'restrictions' as Tab, label: 'Restrictions', icon: '🔒' },
        { id: 'loads' as Tab, label: 'Loads', icon: '⚡' },
        { id: 'loadcases' as Tab, label: 'Load Cases', icon: '📊' },
        { id: '3d-view' as Tab, label: '3D View', icon: '🧊' },
        { id: 'analysis' as Tab, label: 'Analysis', icon: '⚙️' },
        { id: 'verification' as Tab, label: 'Verification', icon: '⚖️' },
        { id: 'results' as Tab, label: 'Results', icon: '📈' },
        { id: 'report' as Tab, label: 'Report', icon: '📝' }
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
                            <div className="p-3 border-t border-slate-800 bg-slate-900/30 space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">External Apps</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => alert("Launching FreeCAD...")}
                                        className="flex items-center justify-center gap-2 p-2 bg-slate-800/50 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/30 rounded-lg group transition-all"
                                    >
                                        <Box className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-400 transition-colors" />
                                        <span className="text-[9px] font-bold text-slate-400 group-hover:text-red-300 uppercase">FreeCAD</span>
                                    </button>
                                    <button
                                        onClick={() => alert("Launching Salome_Meca...")}
                                        className="flex items-center justify-center gap-2 p-2 bg-slate-800/50 hover:bg-amber-500/10 border border-slate-700 hover:border-amber-500/30 rounded-lg group transition-all"
                                    >
                                        <Grid className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 transition-colors" />
                                        <span className="text-[9px] font-bold text-slate-400 group-hover:text-amber-300 uppercase">Salome</span>
                                    </button>
                                </div>
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

                            {activeTab === 'connections' && (
                                <ConnectionConfig
                                    key={projectPath}
                                    projectPath={projectPath}
                                    availableGroups={availableGroups}
                                    nodeGroups={nodeGroups}
                                    initialConnections={projectConfig.connections}
                                    onUpdate={updateConnections}
                                />
                            )}
                            {activeTab === 'contact' && (
                                <ContactConfig
                                    key={projectPath}
                                    projectPath={projectPath}
                                    availableGroups={availableGroups}
                                    initialContacts={projectConfig.contacts}
                                    onUpdate={updateContacts}
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
                            {activeTab === '3d-view' && (
                                <VtkMeshViewer
                                    projectPath={projectPath}
                                    meshKey={Date.now()}
                                    geometries={vtkGeometries}
                                />
                            )}
                            {activeTab === 'analysis' && (
                                <AnalysisConfig
                                    key={projectPath}
                                    projectPath={projectPath}
                                    initialAnalysis={projectConfig.analysis}
                                    onUpdate={updateAnalysis}
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
                                    onUpdate={updateVerification}
                                />
                            )}
                            {activeTab === 'results' && (
                                <PostProcessingTab
                                    key={projectPath}
                                    projectPath={projectPath}
                                />
                            )}
                            {activeTab === 'report' && (
                                <ReportTab
                                    key={projectPath}
                                    projectPath={projectPath}
                                />
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
