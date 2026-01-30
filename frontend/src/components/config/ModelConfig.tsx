import { useEffect, useState } from 'react'

import type { ProjectConfig } from '../StructuralWorkspace'
import CardModelGroup from './CardModelGroup'
import CommandPreview from './CommandPreview'

import {
  buildModelAsterCommand,
  type ModelAsterCommands,
  type AsterAffeEntry
} from './ModelAsterCommands'

/* ===============================
   PROPS
================================ */
interface ModelConfigProps {
  projectConfig: ProjectConfig
  onModelCommandsUpdate?: (commands: any) => void
  onModelUpdate?: (modelData: any) => void
}

/* ===============================
   UI MODEL
================================ */
interface MeshData {
  id: string
  name: string
  dimension: "1D" | "2D" | "3D"
  elementType: string
  elementCount: string
}

/* ===============================
   BACKEND (liberado geral)
================================ */
interface MedBackendResponse {
  [filename: string]: any
}

/* ===============================
   COMPONENT
================================ */
export default function ModelConfig({ projectConfig, onModelCommandsUpdate, onModelUpdate }: ModelConfigProps) {



  /* ===============================
     STATE — MODELE / AFFE
  ================================ */
  const [modelCommands, setModelCommands] = useState<ModelAsterCommands>(() => {
    return (projectConfig?.model as ModelAsterCommands) || { affe: [] }
  })


  /* ===============================
    NOTIFY PARENT WHEN COMMANDS CHANGE
  ================================ */
  useEffect(() => {
    // 1. Generate text preview
    const code = buildModelAsterCommand(modelCommands)

    // 2. Emit formatted commands for Orchestrator
    onModelCommandsUpdate?.({
      commPreview: code,
      caraCommands: []
    })

    // 3. Emit raw data for state persistence
    onModelUpdate?.(modelCommands)
  }, [modelCommands, onModelCommandsUpdate, onModelUpdate])

  /* ===============================
     BACKEND DATA
  ================================ */
  const backendMeshes: MedBackendResponse =
    (projectConfig as any)?.mesh ?? {}

  /* ===============================
     BACKEND → UI ADAPTER
  ================================ */
  const detectedMeshes: MeshData[] = Object.entries(backendMeshes).flatMap(
    ([fileName, mesh]) => {

      const groups = mesh ?? {}

      return Object.entries(groups)
        .filter(([groupName, group]: [string, any]) => {
          if (groupName === "_FULL_MESH_") return false
          if (group?.category === "Node") return false
          return true
        })
        .map(([groupName, group]: [string, any]) => ({
          id: `${fileName}_${groupName}`,
          name: groupName,

          dimension:
            group?.category === "1D" ? "1D" :
              group?.category === "2D" ? "2D" :
                group?.category === "3D" ? "3D" :
                  group?.dimension === 1 ? "1D" :
                    group?.dimension === 2 ? "2D" :
                      group?.dimension === 3 ? "3D" :
                        "3D",

          elementType: group?.med_type ?? "-",
          elementCount: String(group?.count ?? 0),
        }))
    }
  )

  /* ===============================
     GROUP BY DIMENSION
  ================================ */
  const groupedMeshes: Record<"1D" | "2D" | "3D", MeshData[]> = {
    "1D": detectedMeshes.filter(m => m.dimension === "1D"),
    "2D": detectedMeshes.filter(m => m.dimension === "2D"),
    "3D": detectedMeshes.filter(m => m.dimension === "3D"),
  }

  /* ===============================
     UPDATE AFFE (cards → builder)
  ================================ */
  function updateAffeEntry(entry: AsterAffeEntry) {
    setModelCommands(prev => {

      // remove se não tiver modelisation (card desligado)
      if (!entry.modelisation) {
        return {
          ...prev,
          affe: prev.affe.filter(a => a.group !== entry.group)
        }
      }

      const exists = prev.affe.find(a => a.group === entry.group)

      if (exists) {
        return {
          ...prev,
          affe: prev.affe.map(a =>
            a.group === entry.group ? { ...a, ...entry } : a
          )
        }
      }

      return {
        ...prev,
        affe: [...prev.affe, entry]
      }
    })
  }

  /* ===============================
     COMMAND PREVIEW
  ================================ */
  const commandPreviewCode = buildModelAsterCommand(modelCommands)

  /* ===============================
     RENDER
  ================================ */
  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden">

      {/* ================= CONTENT ================= */}
      <div className="flex flex-col flex-1 gap-4 pl-6 pt-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0 pr-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Model Configuration
            </h2>
            <p className="text-sm text-slate-400">
              Define the physical behavior for each mesh group.
            </p>
          </div>

          <div className="px-4 py-1.5 bg-slate-800/80 rounded-full text-xs font-mono text-cyan-400 border border-slate-700 shadow-sm">
            {detectedMeshes.length} Detected Groups
          </div>
        </div>

        {/* Scroll Area */}
        <div className="flex-1 w-full pr-4 overflow-y-auto pb-64">
          <div className="space-y-8 pb-10">

            {(["1D", "2D", "3D"] as const).map(dim => {
              const meshes = groupedMeshes[dim]
              if (meshes.length === 0) return null

              return (
                <div key={dim} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-1 bg-cyan-500 rounded-full" />
                    <h3 className="text-md font-semibold text-slate-200">
                      {dim} Elements
                    </h3>
                    <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {meshes.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                    {meshes.map(mesh => (
                      <CardModelGroup
                        key={mesh.id}
                        meshName={mesh.name}
                        meshDimension={mesh.dimension}
                        elementType={mesh.elementType}
                        elementCount={mesh.elementCount}
                        onChange={updateAffeEntry}
                        initialEntry={modelCommands.affe.find(a => a.group === mesh.name)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}

            {detectedMeshes.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500 border-2 border-dashed border-slate-800/50 rounded-xl bg-slate-900/20">
                <p className="text-lg font-medium">No mesh detected</p>
                <p className="text-sm opacity-70">
                  Check the geometry file import.
                </p>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ================= COMMAND PREVIEW ================= */}
      <div className="sticky bottom-0 w-full border-t border-slate-800 bg-slate-950/95 backdrop-blur">
        <CommandPreview code={commandPreviewCode} />
      </div>

    </div>
  )
}
