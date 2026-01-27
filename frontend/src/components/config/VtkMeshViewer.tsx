import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
    Maximize,
    ZoomIn,
    ZoomOut,
    Box,
    ArrowUp,
    ArrowRight,
    LayoutTemplate,
    Eye,
    EyeOff,
    Layers,
    Grid
} from 'lucide-react'

// Imports do Pipeline Gráfico VTK
import '@kitware/vtk.js/Rendering/Profiles/Geometry'
import vtkRenderWindow from '@kitware/vtk.js/Rendering/Core/RenderWindow'
import vtkRenderer from '@kitware/vtk.js/Rendering/Core/Renderer'
import vtkOpenGLRenderWindow from '@kitware/vtk.js/Rendering/OpenGL/RenderWindow'
import vtkRenderWindowInteractor from '@kitware/vtk.js/Rendering/Core/RenderWindowInteractor'
import vtkInteractorStyleTrackballCamera from '@kitware/vtk.js/Interaction/Style/InteractorStyleTrackballCamera'

// Imports de Dados e Atores
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor'
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper'
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData'

interface VtkMeshViewerProps {
    projectPath: string | null
    meshKey: number
    geometries: any[]
}

const VtkMeshViewer: React.FC<VtkMeshViewerProps> = ({ geometries }) => {
    const vtkContainerRef = useRef<HTMLDivElement>(null)

    // Referências vitais do VTK
    const context = useRef<{
        renderWindow: vtkRenderWindow;
        renderer: vtkRenderer;
        openglRenderWindow: vtkOpenGLRenderWindow;
        interactor: vtkRenderWindowInteractor;
    } | null>(null)

    // Mapa para acessar os atores rapidamente sem recriar a cena
    const actorsMap = useRef<Map<string, vtkActor>>(new Map())

    // Estados de UI
    const [isParallel, setIsParallel] = useState(false)
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
    const [selectedId, setSelectedId] = useState<string | null>(null)

    // Estado para controlar quais objetos mostram as linhas (Edges/Grid)
    const [edgeVisibleIds, setEdgeVisibleIds] = useState<Set<string>>(new Set())

    // 🌟 NOVO: Controle de Opacidade por Objeto (0.0 to 1.0)
    const [opacityMap, setOpacityMap] = useState<Record<string, number>>({})

    // Helper de Cores (Refinados para Profissionalismo)
    const getMeshColor = (id: string, isBase?: boolean) => {
        const isExtrusion = id.includes('EXTRUSION') || id.includes('extrusion')
        const isBeam = id.toLowerCase().includes('beam') || id.toLowerCase().includes('i300')

        if (isExtrusion) {
            if (isBeam) return { r: 0.1, g: 0.8, b: 0.5, hex: '#10b981', name: '3D BEAM' } // Emerald 500
            return { r: 0.2, g: 0.6, b: 0.9, hex: '#3b82f6', name: '3D SHELL' } // Blue 500
        } else if (isBase) {
            return { r: 1.0, g: 0.7, b: 0.0, hex: '#f59e0b', name: 'ORIGINAL_WIRE' } // Amber 500
        } else {
            return { r: 0.6, g: 0.6, b: 0.7, hex: '#94a3b8', name: 'SOLID_VOLUME' } // Slate 400
        }
    }

    // Ações de Interface
    const toggleVisibility = (id: string, isolate = false) => {
        const newHidden = new Set(hiddenIds)
        if (isolate) {
            geometries.forEach(g => {
                if (g.id !== id) newHidden.add(g.id)
            })
            if (newHidden.has(id)) newHidden.delete(id)
        } else {
            if (newHidden.has(id)) newHidden.delete(id)
            else newHidden.add(id)
        }
        setHiddenIds(newHidden)
    }

    const toggleSelection = (id: string) => {
        setSelectedId(prev => prev === id ? null : id)
    }

    const toggleEdges = (id: string) => {
        const newEdges = new Set(edgeVisibleIds)
        if (newEdges.has(id)) newEdges.delete(id)
        else newEdges.add(id)
        setEdgeVisibleIds(newEdges)
    }

    // ------------------------------------------------------------------------
    // 1. INICIALIZAÇÃO DO AMBIENTE
    // ------------------------------------------------------------------------
    useEffect(() => {
        if (!vtkContainerRef.current) return

        const renderWindow = vtkRenderWindow.newInstance()
        const renderer = vtkRenderer.newInstance()
        renderWindow.addRenderer(renderer)

        const openglRenderWindow = vtkOpenGLRenderWindow.newInstance()
        openglRenderWindow.setContainer(vtkContainerRef.current)
        renderWindow.addView(openglRenderWindow)

        const interactor = vtkRenderWindowInteractor.newInstance()
        interactor.setView(openglRenderWindow)
        interactor.initialize()
        interactor.bindEvents(vtkContainerRef.current)

        const style = vtkInteractorStyleTrackballCamera.newInstance()
        interactor.setInteractorStyle(style)

        renderer.setBackground(0.1, 0.12, 0.15)

        context.current = {
            renderWindow,
            renderer,
            openglRenderWindow,
            interactor
        }

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect
                openglRenderWindow.setSize(width, height)
                renderWindow.render()
            }
        })
        resizeObserver.observe(vtkContainerRef.current)

        return () => {
            resizeObserver.disconnect()
            if (context.current) {
                context.current.interactor.delete()
                context.current.openglRenderWindow.delete()
                context.current.renderer.delete()
                context.current.renderWindow.delete()
                context.current = null
            }
        }
    }, [])

    // ------------------------------------------------------------------------
    // 2. CONSTRUÇÃO DA CENA
    // ------------------------------------------------------------------------
    useEffect(() => {
        if (!context.current || !geometries) return

        const { renderer, renderWindow } = context.current

        renderer.removeAllActors()
        actorsMap.current.clear()

        // Configuração Padrão de Edges
        const defaultEdges = new Set<string>()
        geometries.forEach(g => {
            if (!g.id.includes('extrusion')) {
                defaultEdges.add(g.id)
            }
        })
        setEdgeVisibleIds(defaultEdges)

        console.log(`[VTK Viewer] Construindo cena para ${geometries.length} objetos...`)

        geometries.forEach((meshItem) => {
            const { data, id } = meshItem
            if (!data || !data.points) return

            const pointsArray = new Float32Array(data.points)
            const cellArray: number[] = []
            if (data.connectivity) {
                data.connectivity.forEach((cell: number[]) => {
                    cellArray.push(cell.length)
                    cellArray.push(...cell)
                })
            }
            const cellsTyped = new Uint32Array(cellArray)

            const polyData = vtkPolyData.newInstance()
            polyData.getPoints().setData(pointsArray, 3)

            if (data.vtk_type === 2 || data.vtk_type === 3) {
                polyData.getLines().setData(cellsTyped)
            } else {
                polyData.getPolys().setData(cellsTyped)
            }

            const mapper = vtkMapper.newInstance()
            mapper.setInputData(polyData)
            const actor = vtkActor.newInstance()
            actor.setMapper(mapper)

            if (!id.includes('extrusion')) {
                mapper.setResolveCoincidentTopologyToPolygonOffset()
                mapper.setResolveCoincidentTopologyPolygonOffsetParameters(-2, -2)
            }

            renderer.addActor(actor)
            actorsMap.current.set(id, actor)
        })

        // Inicializa opacidade 100% para novos itens detectados
        setOpacityMap(prev => {
            const next = { ...prev }
            geometries.forEach(g => {
                if (next[g.id] === undefined) next[g.id] = 1.0
            })
            return next
        })

        renderer.resetCamera()
        renderWindow.render()

    }, [geometries])

    // ------------------------------------------------------------------------
    // 3. ATUALIZAÇÃO VISUAL
    // ------------------------------------------------------------------------
    useEffect(() => {
        if (!context.current) return
        const { renderWindow } = context.current

        actorsMap.current.forEach((actor, id) => {
            const meshItem = geometries.find(g => g.id === id)
            const isBase = meshItem?.data?.is_base

            const prop = actor.getProperty()
            const baseColor = getMeshColor(id, isBase)
            const isExtrusion = id.includes('EXTRUSION') || id.includes('extrusion')

            const isHidden = hiddenIds.has(id)
            const isSelected = selectedId === id
            const showEdges = edgeVisibleIds.has(id)
            const userOpacity = opacityMap[id] !== undefined ? opacityMap[id] : 1.0

            actor.setVisibility(!isHidden)
            prop.setEdgeVisibility(showEdges)
            prop.setEdgeColor(0.05, 0.05, 0.05) // Quase preto para o grid

            if (isSelected) {
                prop.setColor(1.0, 0.45, 0.0) // Laranja Vibrante Maestro
                prop.setAmbient(0.4)
                prop.setDiffuse(0.8)
                prop.setOpacity(Math.min(userOpacity, 1.0))
                prop.setLineWidth(showEdges ? 3 : 1)
            } else {
                prop.setColor(baseColor.r, baseColor.g, baseColor.b)
                prop.setAmbient(0.15)
                prop.setDiffuse(0.85)

                if (isExtrusion) {
                    prop.setRepresentationToSurface()
                    prop.setOpacity(userOpacity)
                    prop.setLineWidth(1)
                } else {
                    prop.setOpacity(userOpacity)
                    prop.setLineWidth(2)
                }
            }
        })

        renderWindow.render()
    }, [hiddenIds, selectedId, edgeVisibleIds, opacityMap, geometries])

    // ------------------------------------------------------------------------
    // CONTROLADORES
    // ------------------------------------------------------------------------
    const renderScene = () => { if (context.current) context.current.renderWindow.render() }

    const handleResetCamera = useCallback(() => {
        if (!context.current) return
        context.current.renderer.resetCamera()
        renderScene()
    }, [])

    const handleZoom = useCallback((delta: number) => {
        if (!context.current) return
        const camera = context.current.renderer.getActiveCamera()
        if (camera) {
            camera.zoom(delta)
            renderScene()
        }
    }, [])

    const toggleProjection = useCallback(() => {
        if (!context.current) return
        const camera = context.current.renderer.getActiveCamera()
        const newMode = !camera.getParallelProjection()
        camera.setParallelProjection(newMode)
        setIsParallel(newMode)
        context.current.renderer.resetCamera()
        renderScene()
    }, [])

    const setView = useCallback((position: [number, number, number], viewUp: [number, number, number]) => {
        if (!context.current) return
        const camera = context.current.renderer.getActiveCamera()
        camera.setPosition(...position)
        camera.setFocalPoint(0, 0, 0)
        camera.setViewUp(...viewUp)
        context.current.renderer.resetCamera()
        renderScene()
    }, [])

    const handleIso = () => setView([1, -1, 1], [0, 0, 1])
    const handleTop = () => setView([0, 0, 1], [0, 1, 0])
    const handleFront = () => setView([0, -1, 0], [0, 0, 1])
    const handleRight = () => setView([1, 0, 0], [0, 0, 1])


    return (
        <div className="w-full h-full relative overflow-hidden flex flex-col group font-sans">
            <div
                ref={vtkContainerRef}
                className="w-full h-full bg-transparent cursor-crosshair"
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />

            {/* OVERLAY ESQUERDA - GLASSMORPHISM PANEL */}
            <div className="absolute top-4 left-4 w-[340px] flex flex-col gap-2 z-30 max-h-[calc(100%-80px)]">
                <div className="bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
                    {/* Header do Painel */}
                    <div className="px-4 py-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-orange-500/20 rounded border border-orange-500/30">
                                <Layers size={14} className="text-orange-400" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">Scene_Inventory</span>
                                <span className="text-[8px] font-mono text-slate-500 uppercase tracking-tighter">Geometric_Components_Stack</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    const next: any = {}
                                    geometries.forEach(g => next[g.id] = 1.0)
                                    setOpacityMap(next)
                                }}
                                className="text-[8px] font-black text-slate-400 hover:text-white px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/5 transition-all uppercase"
                                title="Reset all to 100% opaque"
                            >
                                Opaque
                            </button>
                            <span className="text-[10px] font-mono font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 border border-orange-500/20 rounded-full">
                                {geometries?.length || 0}
                            </span>
                        </div>
                    </div>

                    {/* Lista de Objetos */}
                    <div className="p-3 flex flex-col gap-2 overflow-y-auto custom-scrollbar">
                        {geometries && geometries.length > 0 ? (
                            geometries.map((mesh) => {
                                const isBase = mesh.data?.is_base
                                const color = getMeshColor(mesh.id, isBase)
                                const isHidden = hiddenIds.has(mesh.id)
                                const isSelected = selectedId === mesh.id
                                const isGridVisible = edgeVisibleIds.has(mesh.id)
                                const currentOpacity = opacityMap[mesh.id] || 1.0

                                return (
                                    <div
                                        key={mesh.id}
                                        onClick={() => toggleSelection(mesh.id)}
                                        className={`
                                            group/item flex flex-col gap-2 p-3 rounded-lg cursor-pointer transition-all border
                                            ${isSelected
                                                ? 'bg-white/10 border-orange-500/50 shadow-[inset_0_0_20px_rgba(249,115,22,0.05)]'
                                                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                                            }
                                            ${isHidden ? 'opacity-40 grayscale-[0.5]' : 'opacity-100'}
                                        `}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Status Indicator */}
                                            <div
                                                className={`w-1.5 h-6 rounded-full transition-all ${isSelected ? 'bg-orange-500 shadow-[0_0_10px_#f97316]' : ''}`}
                                                style={{ backgroundColor: isSelected ? undefined : color.hex }}
                                            />

                                            <div className="flex flex-col min-w-0 flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[10px] font-black truncate uppercase tracking-tight ${isSelected ? 'text-orange-400' : 'text-slate-200'}`}>
                                                        {mesh.id.replace('_EXTRUSION', ' [3D]').replace('_extrusion.json', '').replace('.json', '').replace('_base', ' BASE').replace('_', ' ')}
                                                    </span>
                                                    <div className="flex items-center gap-1.5">
                                                        {/* Botão de Visibilidade */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                toggleVisibility(mesh.id, e.altKey)
                                                            }}
                                                            className={`p-1 rounded transition-colors ${isHidden ? 'text-slate-600' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                                                            title="Toggle Visibility"
                                                        >
                                                            {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                                                        </button>

                                                        {/* Botão de Grid */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                toggleEdges(mesh.id)
                                                            }}
                                                            className={`p-1 rounded transition-colors ${isGridVisible ? 'text-cyan-400' : 'text-slate-600 hover:text-slate-400 hover:bg-white/10'}`}
                                                            title="Wireframe Mode"
                                                        >
                                                            <Grid size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <span className="text-[8px] font-mono text-slate-500 uppercase tracking-tighter">{color.name}</span>
                                            </div>
                                        </div>

                                        {/* Opacity Slider - Apenas visível ou destacado se selecionado/hover */}
                                        <div className="flex items-center gap-3 pl-4.5 pt-1">
                                            <div className="w-full h-4 relative flex items-center">
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.01"
                                                    value={currentOpacity}
                                                    onChange={(e) => {
                                                        e.stopPropagation()
                                                        setOpacityMap(prev => ({ ...prev, [mesh.id]: parseFloat(e.target.value) }))
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500 hover:accent-orange-400 outline-none"
                                                />
                                            </div>
                                            <span className="text-[9px] font-mono text-slate-500 min-w-[30px] text-right">
                                                {Math.round(currentOpacity * 100)}%
                                            </span>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="py-20 text-center flex flex-col items-center gap-4 opacity-20">
                                <Box className="w-12 h-12 text-slate-500" />
                                <span className="text-[10px] font-black uppercase tracking-[0.4em]">awaiting_geometry</span>
                            </div>
                        )}
                    </div>

                    {/* Rodapé do Painel */}
                    <div className="px-4 py-2 bg-black/40 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[8px] font-mono text-slate-600 uppercase tracking-widest">Live_Rendering_Active</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    const next: any = {}
                                    geometries.forEach(g => next[g.id] = 0.2)
                                    setOpacityMap(next)
                                }}
                                className="text-[8px] font-bold text-cyan-500/50 hover:text-cyan-400 transition-colors uppercase"
                            >
                                Ghost_Mode
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* TOOLBAR DIREITA */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-30 pointer-events-none">
                <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-1.5 shadow-xl flex flex-col gap-1 pointer-events-auto">
                    <ToolbarButton onClick={handleIso} icon={<Box size={18} />} title="Isometric View" />
                    <ToolbarButton onClick={handleTop} icon={<LayoutTemplate size={18} />} title="Top View" />
                    <ToolbarButton onClick={handleFront} icon={<ArrowUp size={18} />} title="Front View" />
                    <ToolbarButton onClick={handleRight} icon={<ArrowRight size={18} />} title="Right View" />
                </div>
                <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-1.5 shadow-xl flex flex-col gap-1 pointer-events-auto">
                    <ToolbarButton onClick={handleResetCamera} icon={<Maximize size={18} />} title="Fit All" />
                    <div className="h-px bg-slate-700 my-0.5"></div>
                    <ToolbarButton onClick={() => handleZoom(1.2)} icon={<ZoomIn size={18} />} title="Zoom In" />
                    <ToolbarButton onClick={() => handleZoom(0.8)} icon={<ZoomOut size={18} />} title="Zoom Out" />
                </div>
                <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-1.5 shadow-xl flex flex-col gap-1 pointer-events-auto">
                    <ToolbarButton
                        onClick={toggleProjection}
                        icon={<Eye size={18} />}
                        active={isParallel}
                        title={isParallel ? "Perspective" : "Orthographic"}
                    />
                </div>
            </div>

            {/* RODAPÉ */}
            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
                <div className="text-[10px] text-slate-400 bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
                    <span className="font-bold text-slate-200">LMB:</span> Rotate &nbsp;|&nbsp;
                    <span className="font-bold text-slate-200">Shift+LMB:</span> Pan &nbsp;|&nbsp;
                    <span className="font-bold text-slate-200">RMB:</span> Zoom
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                    VTK.js Viewport
                </div>
            </div>
        </div>
    )
}

const ToolbarButton = ({ onClick, icon, title, active = false }: { onClick: () => void, icon: React.ReactNode, title: string, active?: boolean }) => (
    <button
        onClick={onClick}
        title={title}
        className={`
            p-1.5 rounded-md transition-all active:scale-95
            flex items-center justify-center
            ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}
        `}
    >
        {icon}
    </button>
)

export default VtkMeshViewer