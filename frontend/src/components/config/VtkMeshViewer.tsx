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
    // FileJson, // <--- REMOVIDO PARA CORRIGIR O ERRO
    MousePointer2,
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

    // Helper de Cores
    const getMeshColor = (id: string) => {
        const isExtrusion = id.includes('extrusion')
        const isBeam = id.includes('beam')

        if (isExtrusion) {
            if (isBeam) return { r: 0.2, g: 0.8, b: 0.4, hex: '#33cc66', name: '3D Beam' }
            else return { r: 0.2, g: 0.6, b: 1.0, hex: '#3399ff', name: '3D Shell' }
        } else {
            return { r: 1.0, g: 1.0, b: 0.0, hex: '#ffff00', name: 'Mesh Wire' }
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
            const prop = actor.getProperty()
            const baseColor = getMeshColor(id)
            const isExtrusion = id.includes('extrusion')

            const isHidden = hiddenIds.has(id)
            const isSelected = selectedId === id
            const showEdges = edgeVisibleIds.has(id)

            actor.setVisibility(!isHidden)
            prop.setEdgeVisibility(showEdges)
            prop.setEdgeColor(0, 0, 0)

            if (isSelected) {
                prop.setColor(1.0, 0.4, 0.0)
                prop.setAmbient(0.6)
                prop.setDiffuse(0.8)
                prop.setOpacity(1.0)
                prop.setLineWidth(showEdges ? 3 : 1)
            } else {
                prop.setColor(baseColor.r, baseColor.g, baseColor.b)
                prop.setAmbient(0.1)
                prop.setDiffuse(0.9)

                if (isExtrusion) {
                    prop.setRepresentationToSurface()
                    prop.setOpacity(0.9)
                    prop.setLineWidth(1)
                } else {
                    prop.setOpacity(1.0)
                    prop.setLineWidth(2)
                }
            }
        })

        renderWindow.render()
    }, [hiddenIds, selectedId, edgeVisibleIds, geometries])

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

            {/* OVERLAY ESQUERDA */}
            <div className="absolute top-4 left-4 w-72 flex flex-col gap-2 z-30 max-h-[calc(100%-100px)]">
                <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl overflow-hidden flex flex-col">
                    <div className="px-3 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-200">
                            <Layers size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider">Scene Objects</span>
                        </div>
                        <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full">
                            {geometries?.length || 0}
                        </span>
                    </div>

                    <div className="p-2 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                        {geometries && geometries.length > 0 ? (
                            geometries.map((mesh) => {
                                const color = getMeshColor(mesh.id)
                                const isHidden = hiddenIds.has(mesh.id)
                                const isSelected = selectedId === mesh.id
                                const isGridVisible = edgeVisibleIds.has(mesh.id)

                                return (
                                    <div
                                        key={mesh.id}
                                        onClick={() => toggleSelection(mesh.id)}
                                        className={`
                                            group/item flex items-center gap-2 p-2 rounded cursor-pointer transition-all border
                                            ${isSelected
                                                ? 'bg-slate-800 border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.1)]'
                                                : 'bg-transparent border-transparent hover:bg-slate-800 hover:border-slate-700'
                                            }
                                            ${isHidden ? 'opacity-50' : 'opacity-100'}
                                        `}
                                    >
                                        <div className="flex items-center gap-1 shrink-0">
                                            {/* Botão de Visibilidade */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    toggleVisibility(mesh.id, e.altKey)
                                                }}
                                                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                                                title="Toggle Visibility (Alt+Click to Isolate)"
                                            >
                                                {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>

                                            {/* Botão de Grid */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    toggleEdges(mesh.id)
                                                }}
                                                className={`
                                                    p-1 rounded transition-colors
                                                    ${isGridVisible
                                                        ? 'text-cyan-400 hover:text-cyan-300 hover:bg-slate-700'
                                                        : 'text-slate-600 hover:text-slate-400 hover:bg-slate-700'
                                                    }
                                                `}
                                                title="Toggle Mesh Edges (Wireframe)"
                                            >
                                                <Grid size={14} />
                                            </button>
                                        </div>

                                        <div
                                            className="w-2.5 h-2.5 rounded-full shadow-sm ring-1 ring-white/10 shrink-0 mx-1"
                                            style={{
                                                backgroundColor: isSelected ? '#F97316' : color.hex,
                                                boxShadow: isSelected ? '0 0 8px #F97316' : 'none'
                                            }}
                                        />

                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className={`text-xs truncate ${isSelected ? 'text-orange-400 font-bold' : 'text-slate-200 font-medium'}`}>
                                                {mesh.id.replace('_extrusion.json', '').replace('.json', '')}
                                            </span>
                                        </div>

                                        {isSelected && <MousePointer2 size={12} className="text-orange-500" />}
                                    </div>
                                )
                            })
                        ) : (
                            <div className="p-4 text-center text-slate-500 text-xs italic">
                                Loading geometry...
                            </div>
                        )}
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