import React, { useEffect, useRef, useState } from 'react'
import {
    Activity
} from 'lucide-react'

// vtk.js core
import '@kitware/vtk.js/Rendering/Profiles/Geometry'
import vtkRenderWindow from '@kitware/vtk.js/Rendering/Core/RenderWindow'
import vtkRenderer from '@kitware/vtk.js/Rendering/Core/Renderer'
import vtkOpenGLRenderWindow from '@kitware/vtk.js/Rendering/OpenGL/RenderWindow'
import vtkRenderWindowInteractor from '@kitware/vtk.js/Rendering/Core/RenderWindowInteractor'
import vtkInteractorStyleTrackballCamera from '@kitware/vtk.js/Interaction/Style/InteractorStyleTrackballCamera'

// vtk.js filtering & mapping
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor'
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper'
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData'
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray'
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction'

interface VtkResultViewerProps {
    meshData: any; // { points, connectivity }
    physicsData?: {
        scalars: number[];
        vectors: number[][];
        location: 'node' | 'cell';
    };
    warpScale?: number;
    fieldName?: string;
    unit?: string;
}

const VtkResultViewer: React.FC<VtkResultViewerProps> = ({
    meshData,
    physicsData,
    warpScale = 1.0,
    fieldName = "Result",
    unit = "MPa"
}) => {
    const vtkContainerRef = useRef<HTMLDivElement>(null)
    const context = useRef<any>(null)
    const [stats, setStats] = useState({ min: 0, max: 0 })

    // Initialization
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
        interactor.setInteractorStyle(vtkInteractorStyleTrackballCamera.newInstance())

        renderer.setBackground(0.016, 0.024, 0.05)

        context.current = { renderWindow, renderer, openglRenderWindow, interactor }

        return () => {
            if (context.current) {
                context.current.interactor.delete()
                context.current.openglRenderWindow.delete()
                context.current.renderer.delete()
                context.current.renderWindow.delete()
                context.current = null
            }
        }
    }, [])

    // Scene Construction & Result Mapping
    useEffect(() => {
        if (!context.current || !meshData) return
        const { renderer, renderWindow } = context.current

        try {
            renderer.removeAllActors()

            if (!meshData.points || meshData.points.length === 0) {
                console.warn("[VTK] Mesh report is empty");
                return
            }

            const polyData = vtkPolyData.newInstance()

            // 1. Geometry Construction
            const basePoints = new Float32Array(meshData.points.flat())
            polyData.getPoints().setData(basePoints, 3)

            const cellArray: number[] = []
            meshData.connectivity.forEach((cell: number[]) => {
                cellArray.push(cell.length, ...cell)
            })

            if (cellArray.length > 0) {
                polyData.getPolys().setData(new Uint32Array(cellArray))
            }

            // 2. Physics Application (Native Stream)
            if (physicsData && physicsData.scalars && physicsData.scalars.length > 0) {
                const minVal = Math.min(...physicsData.scalars)
                const maxVal = Math.max(...physicsData.scalars)
                setStats({ min: minVal, max: maxVal })

                const scalars = vtkDataArray.newInstance({
                    name: 'Scalars',
                    values: new Float32Array(physicsData.scalars),
                    numberOfComponents: 1
                })

                const mapper = vtkMapper.newInstance()
                mapper.setInputData(polyData)
                mapper.setScalarVisibility(true)

                // NATIVE ATTR ACTIVATION
                if (physicsData.location === 'cell') {
                    polyData.getCellData().setScalars(scalars)
                    polyData.getCellData().setActiveScalars('Scalars')
                    mapper.setScalarModeToUseCellData()
                } else {
                    polyData.getPointData().setScalars(scalars)
                    polyData.getPointData().setActiveScalars('Scalars')
                    mapper.setScalarModeToUsePointData()
                }

                mapper.setScalarRange(minVal, maxVal)

                const lut = vtkColorTransferFunction.newInstance()
                lut.applyColorMap('Turbo')
                mapper.setLookupTable(lut)

                const actor = vtkActor.newInstance()
                actor.setMapper(mapper)
                actor.getProperty().setEdgeVisibility(true)
                actor.getProperty().setEdgeColor(0.2, 0.2, 0.2)

                renderer.addActor(actor)
            } else {
                // Std Mesh
                const mapper = vtkMapper.newInstance()
                mapper.setInputData(polyData)
                const actor = vtkActor.newInstance()
                actor.setMapper(mapper)
                actor.getProperty().setEdgeVisibility(true)
                renderer.addActor(actor)
            }

            // 3. Optional Warping (Deformation)
            if (physicsData && physicsData.vectors && physicsData.vectors.length > 0 && warpScale > 0) {
                const pts = polyData.getPoints().getData();
                const vecs = physicsData.vectors;
                for (let i = 0; i < vecs.length; i++) {
                    pts[i * 3] += vecs[i][0] * warpScale;
                    pts[i * 3 + 1] += vecs[i][1] * warpScale;
                    pts[i * 3 + 2] += vecs[i][2] * warpScale;
                }
                polyData.getPoints().modified();
            }

            renderer.resetCamera()
            renderWindow.render()

        } catch (err) {
            console.error("[VTK] Scene construction failed:", err)
        }

    }, [meshData, physicsData, warpScale])

    return (
        <div className="w-full h-full relative group bg-slate-950/20 overflow-hidden font-sans">
            <div ref={vtkContainerRef} className="absolute inset-0 cursor-crosshair" />

            {/* Heatmap Overlay */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-2xl min-w-[200px]">
                    <div className="flex items-center gap-3 mb-3 border-b border-white/5 pb-2">
                        <Activity className="text-emerald-400" size={16} />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">{fieldName}_INTENSITY</span>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[8px] text-slate-500 font-bold uppercase">Max_Value</span>
                            <span className="text-xs font-black text-rose-500 font-mono italic">{stats.max.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[8px] text-slate-500 font-bold uppercase">Min_Value</span>
                            <span className="text-xs font-black text-blue-400 font-mono italic">{stats.min.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}</span>
                        </div>
                    </div>
                    <div className="mt-4 h-1.5 w-full rounded-full bg-gradient-to-r from-blue-600 via-emerald-500 via-yellow-400 to-rose-600 shadow-inner" />
                </div>
            </div>

            {/* Meta */}
            <div className="absolute bottom-4 left-4 z-20 flex gap-4 text-[7px] font-bold text-white/30 uppercase tracking-[0.2em]">
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50 animate-pulse" />
                    Renderer: VTK_NATIVE_RESOLVER_V3
                </div>
                <div>Engine: PARA_VIEW_MODULAR_PIPE</div>
            </div>

            <div className="absolute bottom-4 right-16 z-20 text-[7px] text-white/20 uppercase tracking-[0.15em] flex gap-4">
                <span>Lmb: Orbit</span>
                <span>Rmb: Scale</span>
                <span>Wheel: Zoom</span>
            </div>
        </div>
    )
}

export default VtkResultViewer
