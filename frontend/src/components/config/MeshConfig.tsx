import { FileBox } from 'lucide-react'

interface MeshConfigProps {
    projectPath: string | null
    meshes: string[]
}

export default function MeshConfig({ projectPath, meshes }: MeshConfigProps) {
    if (!projectPath) return null

    return (
        <div className="flex flex-col h-full w-full p-4">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Detected Meshes</h3>

            {meshes.length === 0 ? (
                <div className="p-10 text-center text-slate-500 border border-dashed border-slate-700 rounded-lg">
                    No .med files detected in project folder.
                </div>
            ) : (
                <div className="space-y-3">
                    {meshes.map((meshName) => (
                        <div key={meshName} className="flex items-center gap-3 p-4 bg-slate-800 border border-slate-700 rounded-lg">
                            <FileBox className="w-8 h-8 text-blue-500" />
                            <div>
                                <div className="text-sm font-bold text-slate-200">{meshName}</div>
                                <div className="text-xs text-slate-500">
                                    Status: <span className="text-green-500">Ready for Inspection</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-8 p-4 bg-slate-900/50 rounded text-xs text-slate-500">
                <p>Mesh inspection runs automatically when opening the project.</p>
                <p>Ensure <b>Code_Aster path</b> is correctly set in Settings to enable group detection.</p>
            </div>
        </div>
    )
}
