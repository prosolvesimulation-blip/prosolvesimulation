const { useState, useEffect } = React;

// API Configuration
const API_BASE = 'http://localhost:5000/api';

// Helper function to check if API is available
const waitForAPI = () => {
    return new Promise((resolve) => {
        let attempts = 0;
        const checkAPI = async () => {
            attempts++;
            try {
                const response = await fetch(`${API_BASE}/health`);
                if (response.ok) {
                    console.log("✅ API ready after " + attempts + " attempts");
                    resolve();
                    return;
                }
            } catch (error) {
                // API not ready yet
            }

            if (attempts > 50) {
                console.warn("⚠️ API not available after 50 attempts");
                resolve(); // Resolve anyway to avoid hanging
                return;
            }

            setTimeout(checkAPI, 100);
        };
        checkAPI();
    });
};

// Helper: Initialize state from global state if data exists
const getInitialSimulationStatus = () => {
    const globalStatus = window.projectState?.simulationStatus;

    // Check if global state has any actual data (any step with ready: true or files present)
    const hasGlobalData = globalStatus && (
        globalStatus.Geometry?.ready ||
        globalStatus.Mesh?.ready ||
        globalStatus.Config?.ready ||
        globalStatus.PostPro?.ready ||
        (globalStatus.Geometry?.files?.length > 0) ||
        (globalStatus.Mesh?.files?.length > 0) ||
        (globalStatus.Config?.files?.length > 0) ||
        (globalStatus.PostPro?.files?.length > 0)
    );

    if (hasGlobalData) {
        console.log("[Init] Restoring simulationStatus from global state:", globalStatus);
        return globalStatus;
    }

    // Return default empty state
    return {
        Geometry: { ready: false, files: [] },
        Mesh: { ready: false, files: [] },
        Config: { ready: false, files: [] },
        PostPro: { ready: false, files: [] }
    };
};

// Helper: Initialize projectPath from global state if available
const getInitialProjectPath = (externalPath) => {
    // Priority: externalPath > global state > null
    if (externalPath) {
        return externalPath;
    }

    const globalPath = window.projectState?.projectPath;
    if (globalPath) {
        console.log("[Init] Restoring projectPath from global state:", globalPath);
        return globalPath;
    }

    return null;
};

function StructuralWorkflow({ onProjectChange, externalPath, globalSimStatus }) {
    // STATE - Initialize from global state if data exists
    const [projectPath, setProjectPath] = useState(() => getInitialProjectPath(externalPath));
    const [simulationStatus, setSimulationStatus] = useState(() => getInitialSimulationStatus());
    const [isLoading, setIsLoading] = useState(false);
    const [apiReady, setApiReady] = useState(false);
    const [apiStatus, setApiStatus] = useState("Checking...");
    const [showFolderInput, setShowFolderInput] = useState(false);
    const [inputPath, setInputPath] = useState('');

    // Simulation Monitoring State - NOW HANDLED BY PARENT
    // const [simStatus, setSimStatus] = useState('IDLE'); 
    // const [simLogs, setSimLogs] = useState('');
    // const [isPolling, setIsPolling] = useState(false);

    // EFFECT: Check if API is ready
    useEffect(() => {
        const checkAPI = async () => {
            console.log("[Frontend] Checking API health...");
            await waitForAPI();
            try {
                const response = await fetch(`${API_BASE}/health`);
                console.log(`[Frontend] Health check response: ${response.status}`);

                if (response.ok) {
                    const data = await response.json();
                    console.log("[Frontend] API health:", data);
                    setApiReady(true);
                    setApiStatus("Ready ✓");
                    console.log("✅ API is ready");
                } else {
                    throw new Error("Health check failed");
                }
            } catch (error) {
                setApiStatus("Not Available - Start main.pyw");
                console.error("❌ API not available:", error);
            }
        };

        checkAPI();
    }, []);

    // EFFECT: Polling logs REMOVED - Handled by parent
    // useEffect(() => { ... }, [isPolling, projectPath]);

    // EFFECT: Sync with global state changes - keeps data when tab returns
    useEffect(() => {
        const handleGlobalStateChange = () => {
            const globalStatus = window.projectState?.simulationStatus;
            const globalPath = window.projectState?.projectPath;

            if (globalStatus) {
                console.log("[Pipeline] Syncing with global state:", globalStatus);
                setSimulationStatus(globalStatus);
            }

            if (globalPath && globalPath !== projectPath) {
                console.log("[Pipeline] Syncing projectPath from global state:", globalPath);
                setProjectPath(globalPath);
            }
        };

        window.addEventListener('projectStateChanged', handleGlobalStateChange);

        return () => {
            window.removeEventListener('projectStateChanged', handleGlobalStateChange);
        };
    }, [projectPath]);

    // EFFECT: Update when externalPath changes
    useEffect(() => {
        if (externalPath && externalPath !== projectPath) {
            console.log("[Pipeline] External path changed, scanning:", externalPath);
            setProjectPath(externalPath);
            scanFolderForFiles(externalPath);
        }
    }, [externalPath]);

    // FUNCTION: Scan folder and update simulation status
    const scanFolderForFiles = async (folderPath) => {
        if (!folderPath) return;

        setIsLoading(true);
        console.log(`[Frontend] Starting scan for: ${folderPath}`);

        try {
            console.log(`[Frontend] Sending request to API...`);
            const response = await fetch(`${API_BASE}/scan_workspace`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ folder_path: folderPath })
            });

            console.log(`[Frontend] Response status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Frontend] API error: ${response.statusText} - ${errorText}`);
                throw new Error(`API error: ${response.statusText}`);
            }

            const result = await response.json();
            console.log(`[Frontend] API returned:`, result);

            // Map the API response to our status structure - now handles multiple files
            const newStatus = {
                Geometry: {
                    ready: result.Geometry,
                    files: result.files?.Geometry || []
                },
                Mesh: {
                    ready: result.Mesh,
                    files: result.files?.Mesh || []
                },
                Config: {
                    ready: result.Config,
                    files: result.files?.Config || []
                },
                PostPro: {
                    ready: result["Post-Pro"],
                    files: result.files?.["Post-Pro"] || []
                }
            };

            setSimulationStatus(newStatus);

            // If meshes are present, assume a simulation was triggered and notify parent to start polling
            if (result.Mesh) {
                // setSimStatus('RUNNING'); // Local
                // setIsPolling(true);      // Local
                window.dispatchEvent(new Event('startSimulation'));
            }

            // ALSO update global state so other components can access it
            window.projectState.updateSimulationStatus(newStatus);
            window.projectState.projectPath = folderPath;
            console.log("✅ Global state updated:", window.projectState.simulationStatus);

            console.log("✅ Folder scanned successfully:", folderPath);
        } catch (error) {
            console.error("❌ Error scanning folder:", error);
            alert("Error scanning folder: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };


// FUNCTION: Open Native Folder Dialog
    const openFolderDialog = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE}/browse_folder`, { method: 'POST' });
            const data = await response.json();

            if (data.status === 'success' && data.path) {
                console.log("Pasta selecionada:", data.path);
                setProjectPath(data.path);
                
                if (onProjectChange) onProjectChange(data.path);
                
                await scanFolderForFiles(data.path);
            }
        } catch (error) {
            alert("Erro ao abrir diálogo: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };



    // FUNCTION: Refresh scan
    const refreshScan = () => {
        if (projectPath) {
            scanFolderForFiles(projectPath);
        }
    };

    // COMPONENT: Status Card
    const StatusCard = ({ title, icon, status, type }) => {
        const isReady = status.ready;
        const fileList = Array.isArray(status.files) ? status.files : [];

        // Custom badges for Config card during simulation
        let badge = isReady ? '✓ Ready' : '○ Pending';
        let badgeColor = isReady ? 'text-green-400' : 'text-slate-500';

        if (type === 'Config' && isReady) {
            if (globalSimStatus === 'RUNNING') {
                badge = '⚡ Running...';
                badgeColor = 'text-blue-400 animate-pulse';
            } else if (globalSimStatus === 'SUCCESS') {
                badge = '🏆 Success';
                badgeColor = 'text-green-400 font-black';
            } else if (globalSimStatus === 'FAILED') {
                badge = '❌ Failed';
                badgeColor = 'text-red-400 font-bold';
            }
        }

        return (
            <div className={`p-6 rounded-xl border-2 transition-all duration-300 flex-1 ${isReady
                ? (type === 'Config' && globalSimStatus === 'FAILED' ? 'border-red-500 bg-red-500/10' : 'border-green-500 bg-green-500/10 shadow-lg')
                : 'border-slate-700 bg-slate-800/50 opacity-60'
                }`}>
                <div className="flex flex-col items-center gap-3 text-center">
                    <span className="text-4xl">{icon}</span>
                    <h3 className="font-bold text-lg">{title}</h3>
                    <p className={`text-xs font-bold uppercase tracking-wider ${badgeColor}`}>
                        {badge}
                    </p>
                    {fileList.length > 0 && (
                        <div className="text-xs text-slate-300 mt-2 w-full text-left max-h-20 overflow-y-auto">
                            {fileList.map((file, idx) => (
                                <div key={idx} className="truncate text-slate-400 mb-1">
                                    • {file}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // COMPONENT: Simulation Console REMOVED - Handled by parent
    // const SimulationConsole = () => { ... }

    // RENDER: No project selected
    if (!projectPath) {
        return (
            <div className="flex flex-col items-center justify-center min-h-96 gap-8 p-8">
                {/* API Status */}
                <div className="text-xs text-slate-400">
                    API Status: <span className={apiReady ? "text-green-400" : "text-amber-400"}>{apiStatus}</span>
                </div>

                {!showFolderInput ? (
                    <>
                        <div className="text-center space-y-4">
                            <div className="text-6xl">📂</div>
                            <h2 className="text-3xl font-light text-slate-200">No Project Selected</h2>
                            <p className="text-slate-400 max-w-md">
                                Select a folder containing your project files to view simulation status.
                            </p>
                        </div>

                        <button
                            onClick={openFolderDialog}
                            disabled={isLoading || !apiReady}
                            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white font-bold py-3 px-10 rounded-lg shadow-lg transition-colors cursor-pointer"
                            type="button"
                        >
                            {!apiReady ? "API Loading..." : isLoading ? "Loading..." : "Select Project Folder"}
                        </button>
                    </>
                ) : (
                    // Folder Input Dialog
                    <div className="bg-slate-800 border border-slate-600 rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4 text-slate-200">Enter Project Folder Path</h3>
                        <p className="text-sm text-slate-400 mb-4">
                            Example: <br />
                            C:\Users\jorge\OneDrive\ProSolve_Studio\prosolve
                        </p>
                        <input
                            type="text"
                            value={inputPath}
                            onChange={(e) => setInputPath(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleFolderInputSubmit()}
                            placeholder="Enter full path..."
                            className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-600 text-white placeholder-slate-500 mb-4 focus:outline-none focus:border-blue-500"
                            autoFocus
                        />
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setShowFolderInput(false);
                                    setInputPath('');
                                }}
                                className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleFolderInputSubmit}
                                disabled={!inputPath.trim() || isLoading}
                                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white transition-colors font-bold"
                            >
                                {isLoading ? "Loading..." : "Open"}
                            </button>
                        </div>
                    </div>
                )}

                {!apiReady && (
                    <p className="text-xs text-amber-300">
                        💡 Tip: Make sure main.pyw is running in the terminal.
                    </p>
                )}
            </div>
        );
    }

    // RENDER: Project selected - show status
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Project Path Header */}
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-2xl">📁</span>
                    <div className="min-w-0">
                        <p className="text-xs uppercase font-bold text-slate-500 tracking-wider">Project Folder</p>
                        <p className="text-sm font-mono text-blue-300 truncate">{projectPath}</p>
                    </div>
                </div>

                <div className="flex gap-2 ml-4">
                    <button
                        onClick={refreshScan}
                        disabled={isLoading}
                        className="p-2 rounded bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 transition-colors cursor-pointer"
                        title="Refresh"
                        type="button"
                    >
                        🔄
                    </button>
                    <button
                        onClick={openFolderDialog}
                        disabled={isLoading}
                        className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-xs transition-colors cursor-pointer border border-slate-600"
                        type="button"
                    >
                        Change
                    </button>
                </div>
            </div>

            {/* Simulation Status Pipeline */}
            <div>
                <h3 className="text-sm uppercase font-bold text-slate-400 mb-4 tracking-widest">Simulation Pipeline</h3>
                <div className="grid grid-cols-4 gap-4">
                    <StatusCard
                        title="Geometry"
                        icon="📐"
                        status={simulationStatus.Geometry}
                    />
                    <StatusCard
                        title="Mesh"
                        icon="🕸️"
                        status={simulationStatus.Mesh}
                    />
                    <StatusCard
                        title="Config"
                        icon="⚙️"
                        status={simulationStatus.Config}
                        type="Config"
                    />
                    <StatusCard
                        title="Results"
                        icon="📊"
                        status={simulationStatus.PostPro}
                    />
                </div>
            </div>

            {/* Simulation Console REMOVED - Handled by parent */}
            {/* <SimulationConsole /> */}

            {/* Loading Indicator */}
            {isLoading && (
                <div className="text-center text-slate-400 py-4">
                    <p>Scanning folder...</p>
                </div>
            )};

            {/* Helper Messages */}
            {!simulationStatus.Geometry.ready && (
                <div className="bg-amber-500/10 border-l-4 border-amber-500 p-4 rounded text-sm text-amber-300">
                    <strong>Missing:</strong> .STEP or .STP file (Geometry)
                </div>
            )}

            {/* Success/Error Messages handled by parent or kept minimal here? 
                Actually, removing them from here since parent handles console/status.
                But maybe keep them for local feedback if needed.
                For now, commenting out to avoid duplication with parent console.
            */}

            {/* {simStatus === 'SUCCESS' && (
                <div className="bg-green-500/10 border-l-4 border-green-500 p-4 rounded text-sm text-green-300 animate-in zoom-in duration-300">
                    <strong>Great!</strong> Simulation completed successfully.
                </div>
            )}

            {simStatus === 'FAILED' && (
                <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded text-sm text-red-300 animate-in shake duration-500">
                    <strong>Error:</strong> Simulation failed. Check the console above for details.
                </div>
            )} */}
        </div>
    );
}

// Export for global access
window.StructuralWorkflow = StructuralWorkflow;
