import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface Material {
    id: string
    name: string
    E: string // Young's Modulus
    nu: string // Poisson's Ratio
    rho: string // Density
}

interface MaterialConfigProps {
    projectPath: string | null
    initialMaterials?: any[]
    onUpdate?: (materials: any[]) => void
}

export default function MaterialConfig({ projectPath, initialMaterials = [], onUpdate }: MaterialConfigProps) {
    const isFirstRender = useRef(true)
    const [materials, setMaterials] = useState<Material[]>([
        {
            id: '1',
            name: 'Steel_S355',
            E: '210000',
            nu: '0.3',
            rho: '7850'
        }
    ])

    // Load initial materials
    useEffect(() => {
        if (initialMaterials.length > 0) {
            const formatted = initialMaterials.map((m, index) => ({
                id: (index + 1).toString(),
                name: m.name,
                E: (m.E / 1e6).toString(), // Pa to MPa
                nu: m.nu.toString(),
                rho: m.rho.toString()
            }))
            setMaterials(formatted)
        }
    }, [initialMaterials])

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        if (onUpdate) {
            const exportData = materials.map(m => ({
                name: m.name,
                E: parseFloat(m.E) * 1e6, // MPa to Pa
                nu: parseFloat(m.nu),
                rho: parseFloat(m.rho)
            }))
            onUpdate(exportData)
        }
    }, [materials, onUpdate])

    const addMaterial = () => {
        const newId = (materials.length + 1).toString()
        setMaterials([
            ...materials,
            {
                id: newId,
                name: `Material_${newId}`,
                E: '210000',
                nu: '0.3',
                rho: '7850'
            }
        ])
    }

    const removeMaterial = (id: string) => {
        if (materials.length === 1) {
            alert('At least one material is required')
            return
        }
        setMaterials(materials.filter(m => m.id !== id))
    }

    const updateMaterial = (id: string, field: keyof Material, value: string) => {
        setMaterials(
            materials.map(m => (m.id === id ? { ...m, [field]: value } : m))
        )
    }

    if (!projectPath) {
        return <div className="p-10 text-center text-slate-500">Please select a project.</div>
    }

    return (
        <div className="flex flex-col h-full w-full p-4">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-200">Material Properties</h3>
                <button
                    onClick={addMaterial}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add Material
                </button>
            </div>

            {/* Materials List */}
            <div className="space-y-4 flex-1 overflow-y-auto">
                {materials.map((material) => (
                    <div
                        key={material.id}
                        className="bg-slate-800 border border-slate-700 rounded-lg p-4"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <input
                                type="text"
                                value={material.name}
                                onChange={(e) => updateMaterial(material.id, 'name', e.target.value)}
                                className="text-lg font-semibold bg-slate-900 border border-slate-600 rounded px-3 py-1 text-blue-300 focus:outline-none focus:border-blue-500"
                                placeholder="Material Name"
                            />
                            <button
                                onClick={() => removeMaterial(material.id)}
                                className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                disabled={materials.length === 1}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            {/* Young's Modulus */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    Young's Modulus E (MPa)
                                </label>
                                <input
                                    type="number"
                                    value={material.E}
                                    onChange={(e) => updateMaterial(material.id, 'E', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                                    placeholder="210000"
                                />
                            </div>

                            {/* Poisson's Ratio */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    Poisson's Ratio ν
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={material.nu}
                                    onChange={(e) => updateMaterial(material.id, 'nu', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                                    placeholder="0.3"
                                />
                            </div>

                            {/* Density */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">
                                    Density ρ (kg/m³)
                                </label>
                                <input
                                    type="number"
                                    value={material.rho}
                                    onChange={(e) => updateMaterial(material.id, 'rho', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                                    placeholder="7850"
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
