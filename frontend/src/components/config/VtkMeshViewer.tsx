import React, { useEffect, useState, useRef } from 'react'

interface VtkMeshViewerProps {
    projectPath: string | null
    meshKey: number
    geometries: any[]
}

const VtkMeshViewer: React.FC<VtkMeshViewerProps> = ({ projectPath }) => {
    const [status, setStatus] = useState<string>('Initializing...')
    const [error, setError] = useState<string | null>(null)
    const launchedRef = useRef(false)

    useEffect(() => {
        if (!projectPath || launchedRef.current) return

        const launchStandalone = async () => {
            setStatus('Launching Standalone Viewer...')
            try {
                const response = await fetch('/api/open_standalone_viewer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folder_path: projectPath })
                })

                const data = await response.json()

                if (data.status === 'success') {
                    setStatus(`Viewer Launched: ${data.target}`)
                    launchedRef.current = true
                } else {
                    throw new Error(data.message)
                }
            } catch (e: any) {
                setError(e.message || 'Failed to launch viewer')
                setStatus('Error')
            }
        }

        launchStandalone()
    }, [projectPath])

    const handleRetry = () => {
        launchedRef.current = false
        setStatus('Retrying...')
        setError(null)
    }

    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 border border-slate-700 rounded-lg p-6">
            <div className="text-center space-y-4">
                <div className="text-4xl">🚀</div>

                <div>
                    <h3 className="text-xl font-bold text-white">External 3D Viewer</h3>
                    <p className="text-slate-400 text-sm mt-1">{status}</p>
                </div>

                {error && (
                    <div className="bg-red-900/30 border border-red-500/50 p-4 rounded text-red-200 text-sm max-w-md mx-auto">
                        <p className="font-bold mb-1">Launch Failed:</p>
                        {error}
                        <button
                            onClick={handleRetry}
                            className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-xs transition-colors"
                        >
                            Retry Launch
                        </button>
                    </div>
                )}

                {!error && status.includes('Launched') && (
                    <div className="text-xs text-sky-400/80 animate-pulse">
                        Check your taskbar for the visualization window
                    </div>
                )}
            </div>
        </div>
    )
}

export default VtkMeshViewer
