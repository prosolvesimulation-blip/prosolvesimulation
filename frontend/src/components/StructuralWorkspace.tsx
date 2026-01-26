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

interface StructuralWorkspaceProps {
    onBack: () => void
    projectPath: string | null
    setProjectPath: (path: string | null) => void
}

type Tab = 'model' | 'mesh' | 'material' | 'geometry' | 'restrictions' | 'loads' | 'loadcases' | '3d-view'

interface ProjectConfig {
    geometries: any[]
    materials: any[]
    restrictions: any[]
    loads: any[]
    load_cases: any[]
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
        load_cases: []
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
        { id: 'loadcases' as Tab, label: 'Load Cases', icon: '📊' }
    ]

    return (
        <div className="h-full w-full flex flex-col bg-slate-900">
            {/* Toolbar */}
            <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center px-4 gap-3 shrink-0">
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm font-medium">Back</span>
                </motion.button>

                <div className="h-8 w-px bg-slate-700" />

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleOpenFolder}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
                >
                    <FolderOpen className="w-4 h-4" />
                    <span className="text-sm font-medium">
                        {isLoading ? 'Opening...' : 'Open Project'}
                    </span>
                </motion.button>

                {projectPath && (
                    <>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleSaveProject}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
                        >
                            <Save className="w-4 h-4" />
                            <span className="text-sm font-medium">Save Project</span>
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleRunSimulation}
                            disabled={simulationRunning}
                            className={`flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors ${simulationRunning ? 'opacity-50' : ''}`}
                        >
                            <Play className="w-4 h-4" />
                            <span className="text-sm font-medium">
                                {simulationRunning ? 'Running...' : 'Run Simulation'}
                            </span>
                        </motion.button>
                    </>
                )}

                {projectPath && (
                    <div className="ml-auto text-sm text-slate-400 font-mono truncate max-w-md">
                        {projectPath}
                    </div>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {!projectPath ? (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <FolderOpen className="w-24 h-24 text-slate-600 mb-6" />
                        <h2 className="text-2xl font-semibold text-slate-400 mb-2">
                            No Project Selected
                        </h2>
                        <p className="text-slate-500 text-center max-w-md">
                            Click "Open Project" to select a folder containing your geometry
                            and mesh files.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Tab Navigation */}
                        <div className="w-48 bg-slate-800 border-r border-slate-700 p-4 space-y-2">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === tab.id
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                                        }`}
                                >
                                    <span className="text-xl">{tab.icon}</span>
                                    <span className="font-medium text-sm">{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-hidden">
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
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
