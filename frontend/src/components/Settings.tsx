import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Settings as SettingsIcon, Save, FolderOpen, AlertCircle } from 'lucide-react'

interface SettingsProps {
    onClose: () => void
}

interface ToolSettings {
    freecad_path: string
    salome_path: string
    aster_path: string
}

export default function Settings({ onClose }: SettingsProps) {
    const [settings, setSettings] = useState<ToolSettings>({
        freecad_path: '',
        salome_path: '',
        aster_path: '',
    })
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    useEffect(() => {
        // Load existing settings
        async function loadConfig() {
            try {
                const res = await fetch('/api/get_settings')
                const data = await res.json()
                if (data.status === 'success' && data.settings) {
                    setSettings({
                        freecad_path: data.settings.freecad_path || '',
                        salome_path: data.settings.salome_path || '',
                        aster_path: data.settings.aster_path || ''
                    })
                }
            } catch (e) {
                console.error("Failed to load settings", e)
            }
        }
        loadConfig()
    }, [])

    const handleBrowse = async (field: keyof ToolSettings) => {
        try {
            const response = await fetch('/api/open_folder_dialog')
            const data = await response.json()

            if (data.status === 'success' && data.path) {
                setSettings(prev => ({ ...prev, [field]: data.path }))
            }
        } catch (error) {
            console.error('Failed to open dialog:', error)
        }
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const res = await fetch('/api/save_settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            })
            const data = await res.json()

            if (data.status === 'success') {
                setMessage({ type: 'success', text: 'Settings saved successfully!' })
                setTimeout(() => setMessage(null), 3000)
            } else {
                setMessage({ type: 'error', text: 'Failed: ' + data.message })
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save settings' })
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl mx-4"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <SettingsIcon className="w-6 h-6 text-blue-400" />
                        <h2 className="text-2xl font-bold text-slate-100">Application Settings</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {message && (
                        <div
                            className={`flex items-center gap-2 p-4 rounded-lg ${message.type === 'success'
                                ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                                : 'bg-red-500/10 border border-red-500/20 text-red-400'
                                }`}
                        >
                            <AlertCircle className="w-5 h-5" />
                            <span className="text-sm">{message.text}</span>
                        </div>
                    )}

                    {/* FreeCAD */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            FreeCAD Executable
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={settings.freecad_path}
                                onChange={(e) => setSettings(prev => ({ ...prev, freecad_path: e.target.value }))}
                                placeholder="C:\Program Files\FreeCAD\bin\FreeCAD.exe"
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-blue-500 transition-colors font-mono text-sm"
                            />
                            <button
                                onClick={() => handleBrowse('freecad_path')}
                                className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <FolderOpen className="w-4 h-4" />
                                Browse
                            </button>
                        </div>
                    </div>

                    {/* Salome */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Salome Executable
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={settings.salome_path}
                                onChange={(e) => setSettings(prev => ({ ...prev, salome_path: e.target.value }))}
                                placeholder="C:\SALOME\salome.bat"
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-blue-500 transition-colors font-mono text-sm"
                            />
                            <button
                                onClick={() => handleBrowse('salome_path')}
                                className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <FolderOpen className="w-4 h-4" />
                                Browse
                            </button>
                        </div>
                    </div>

                    {/* Code_Aster */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Code_Aster Path
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={settings.aster_path}
                                onChange={(e) => setSettings(prev => ({ ...prev, aster_path: e.target.value }))}
                                placeholder="C:\CodeAster\bin\as_run"
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-blue-500 transition-colors font-mono text-sm"
                            />
                            <button
                                onClick={() => handleBrowse('aster_path')}
                                className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <FolderOpen className="w-4 h-4" />
                                Browse
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
