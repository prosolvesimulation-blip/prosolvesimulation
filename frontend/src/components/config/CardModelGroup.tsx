import * as React from "react"
import { Card } from "../ui/card"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Checkbox } from "../ui/checkbox"

import modelOptionsData from "../../data/modelOptions.json"
import type { AsterAffeEntry } from "./ModelAsterCommands"

/* =======================
   Props
======================= */
interface CardModelGroupProps {
  meshName: string
  meshDimension: "1D" | "2D" | "3D"
  elementType: string
  elementCount: string
  onChange: (entry: AsterAffeEntry) => void
}

/* =======================
   JSON Types
======================= */
interface Modelisation {
  name: string
  label_en: string
  description: string
  formulations: string[]
}

interface Phenomenon {
  phenomene: string
  label_en: string
  modelisations: Modelisation[]
}

interface DimensionData {
  dimension: string
  description: string
  phenomenes: Phenomenon[]
}

/* =======================
   Component
======================= */
export default function CardModelGroup({
  meshName,
  meshDimension,
  elementType,
  elementCount,
  onChange,
  initialEntry
}: CardModelGroupProps & { initialEntry?: AsterAffeEntry }) {

  /* =======================
     UI STATE
  ======================= */
  const [isAlive, setIsAlive] = React.useState(!!initialEntry)
  const [isExpanded, setIsExpanded] = React.useState(!!initialEntry)

  /* =======================
     SELECTION STATE
  ======================= */
  const [selectedPhenomenonId, setSelectedPhenomenonId] = React.useState(initialEntry?.phenomenon || "")
  const [selectedModelId, setSelectedModelId] = React.useState(initialEntry?.modelisation || "")
  const [selectedFormulation, setSelectedFormulation] = React.useState(initialEntry?.formulation || "")

  /* =======================
     DATA FILTERING
  ======================= */
  const currentDimensionData = React.useMemo(() => {
    return (modelOptionsData as DimensionData[])
      .find(d => d.dimension === meshDimension)
  }, [meshDimension])

  const availablePhenomena = React.useMemo(
    () => currentDimensionData?.phenomenes ?? [],
    [currentDimensionData]
  )

  const availableModels = React.useMemo(() => {
    return availablePhenomena
      .find(p => p.phenomene === selectedPhenomenonId)
      ?.modelisations ?? []
  }, [availablePhenomena, selectedPhenomenonId])

  const availableFormulations = React.useMemo(() => {
    return availableModels
      .find(m => m.name === selectedModelId)
      ?.formulations ?? []
  }, [availableModels, selectedModelId])

  /* =======================
     AUTO-SELECTION
  ======================= */
  React.useEffect(() => {
    if (availablePhenomena.length && !selectedPhenomenonId) {
      setSelectedPhenomenonId(availablePhenomena[0].phenomene)
    }
  }, [availablePhenomena, selectedPhenomenonId])

  React.useEffect(() => {
    if (availableModels.length && !selectedModelId) {
      setSelectedModelId(availableModels[0].name)
    }
  }, [availableModels, selectedModelId])

  React.useEffect(() => {
    if (availableFormulations.length && !selectedFormulation) {
      setSelectedFormulation(availableFormulations[0])
    }
  }, [availableFormulations, selectedFormulation])

  /* =======================
     EMIT TO BUILDER
  ======================= */
  React.useEffect(() => {
    // Only emit changes if alive or if it was alive (to delete it)
    // We need to avoid emitting on mount if it's just hydration, unless user changes something.
    // The current logic emits constantly which might be okay but let's be careful.

    if (!isAlive) {
      // remove do builder
      onChange({
        group: meshName,
        phenomenon: "",
        modelisation: ""
      })
      return
    }

    if (!selectedPhenomenonId || !selectedModelId) return

    onChange({
      group: meshName,
      phenomenon: selectedPhenomenonId,
      modelisation: selectedModelId,
      formulation: selectedFormulation || undefined
    })
  }, [
    isAlive,
    meshName,
    selectedPhenomenonId,
    selectedModelId,
    selectedFormulation,
    onChange
  ])

  /* =======================
     HELPERS
  ======================= */
  const getPhenomenonLabel = (id: string) =>
    availablePhenomena.find(p => p.phenomene === id)?.label_en ?? "-"

  const getModelLabel = (id: string) => {
    const model = availableModels.find(m => m.name === id)
    return model ? `${model.label_en} (${model.name})` : "-"
  }

  if (!currentDimensionData) {
    return (
      <div className="p-4 text-red-500 border border-red-500 rounded">
        Configuration not found for {meshDimension}
      </div>
    )
  }

  /* =======================
     RENDER
  ======================= */
  return (
    <div className="w-full group">
      <h3 className="text-lg font-bold mb-2 truncate">{meshName}</h3>

      <Card className={isAlive ? "border-cyan-500" : "opacity-60"}>
        {/* ================= HEADER ================= */}
        <div className="flex justify-between p-4">
          <div className="flex gap-3">
            <Checkbox
              checked={isAlive}
              onCheckedChange={v => {
                const checked = v === true
                setIsAlive(checked)
                if (checked) setIsExpanded(true)
              }}
            />

            <div className="flex gap-2">
              <Badge>{meshDimension}</Badge>
              <Badge>{elementType}</Badge>
              <Badge>{elementCount}</Badge>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(v => !v)}
          >
            {isExpanded ? "▼" : "▶"}
          </Button>
        </div>

        {/* ================= CONTENT ================= */}
        {isExpanded && (
          <div className="p-4 space-y-4 border-t">

            {/* Phenomenon */}
            <div>
              <h4 className="text-xs uppercase mb-1">Phenomenon</h4>
              <div className="flex gap-2 flex-wrap">
                {availablePhenomena.map(p => (
                  <Button
                    key={p.phenomene}
                    size="sm"
                    variant={selectedPhenomenonId === p.phenomene ? "default" : "outline"}
                    onClick={() => setSelectedPhenomenonId(p.phenomene)}
                  >
                    {p.label_en}
                  </Button>
                ))}
              </div>
            </div>

            {/* Model */}
            <div>
              <h4 className="text-xs uppercase mb-1">Model</h4>
              <div className="flex flex-col gap-2">
                {availableModels.map(m => (
                  <Button
                    key={m.name}
                    size="sm"
                    variant={selectedModelId === m.name ? "default" : "outline"}
                    onClick={() => setSelectedModelId(m.name)}
                  >
                    {m.label_en} ({m.name})
                  </Button>
                ))}
              </div>
            </div>

            {/* Formulation */}
            {availableFormulations.length > 0 && (
              <div>
                <h4 className="text-xs uppercase mb-1">Formulation</h4>
                <div className="flex gap-2 flex-wrap">
                  {availableFormulations.map(f => (
                    <Button
                      key={f}
                      size="sm"
                      variant={selectedFormulation === f ? "default" : "outline"}
                      onClick={() => setSelectedFormulation(f)}
                    >
                      {f}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= SUMMARY ================= */}
        {!isExpanded && (
          <div className="p-4 text-xs border-t text-slate-400">
            <div>Phenomenon: {getPhenomenonLabel(selectedPhenomenonId)}</div>
            <div>Model: {getModelLabel(selectedModelId)}</div>
          </div>
        )}
      </Card>
    </div>
  )
}
