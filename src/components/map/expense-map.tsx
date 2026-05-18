"use client"

/**
 * Interactive expense map using MapLibre GL via react-map-gl.
 * Tiles from OpenFreeMap (free, no API key).
 */

import { useRef, useCallback, useMemo } from "react"
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { GeoInsight } from "@/lib/geo-patterns"
import type { Expense } from "@/types"

type GeoExpense = Expense & { geo: { lat: number; lng: number } }

// Category colors for map dots
const CAT_COLORS: Record<string, string> = {
  comida:       "#f59e0b",
  transporte:   "#3b82f6",
  supermercado: "#22c55e",
  ocio:         "#8b5cf6",
  salud:        "#ef4444",
  combustible:  "#f97316",
  hogar:        "#64748b",
  servicios:    "#14b8a6",
  otros:        "#94a3b8",
}

interface Props {
  expenses: Expense[]
  insights: GeoInsight[]
  selectedInsightId: string | null
  selectedExpenseId: string | null
  onSelectExpense: (id: string | null) => void
}

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty"

export function ExpenseMap({
  expenses,
  insights,
  selectedInsightId,
  selectedExpenseId,
  onSelectExpense,
}: Props) {
  // Filter to only expenses with geo data
  const geoExpenses = useMemo(
    () => expenses.filter((e): e is GeoExpense => !!(e as GeoExpense).geo?.lat),
    [expenses],
  )

  // Highlight expenses that belong to the selected insight
  const highlightIds = useMemo(() => {
    if (!selectedInsightId) return new Set<string>()
    const insight = insights.find((i) => i.id === selectedInsightId)
    return new Set(insight?.relatedExpenseIds ?? [])
  }, [selectedInsightId, insights])

  // Compute initial viewport from data centroid
  const initialViewState = useMemo(() => {
    if (!geoExpenses.length) return { longitude: -74.006, latitude: 40.7128, zoom: 3 }
    const lat = geoExpenses.reduce((s, e) => s + e.geo.lat, 0) / geoExpenses.length
    const lng = geoExpenses.reduce((s, e) => s + e.geo.lng, 0) / geoExpenses.length
    return { longitude: lng, latitude: lat, zoom: geoExpenses.length === 1 ? 13 : 10 }
  }, [geoExpenses])

  const selectedExpense = useMemo(
    () => geoExpenses.find((e) => e.id === selectedExpenseId) ?? null,
    [geoExpenses, selectedExpenseId],
  )

  if (!geoExpenses.length) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30 rounded-2xl border">
        <div className="text-center p-8">
          <p className="text-4xl mb-3">🗺️</p>
          <p className="text-sm font-medium">Sin datos de ubicación</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-48">
            Activa la ubicación al registrar gastos para ver el mapa
          </p>
        </div>
      </div>
    )
  }

  return (
    <Map
      initialViewState={initialViewState}
      mapStyle={STYLE_URL}
      style={{ width: "100%", height: "100%", borderRadius: "16px" }}
      onClick={() => onSelectExpense(null)}
    >
      <NavigationControl position="top-right" />

      {/* Expense markers */}
      {geoExpenses.map((exp) => {
        const isHighlighted = selectedInsightId ? highlightIds.has(exp.id) : true
        const isSelected    = exp.id === selectedExpenseId
        const color = CAT_COLORS[exp.category ?? "otros"] ?? CAT_COLORS.otros
        const size  = isSelected ? 20 : isHighlighted ? 14 : 10

        return (
          <Marker
            key={exp.id}
            longitude={exp.geo.lng}
            latitude={exp.geo.lat}
            anchor="center"
            onClick={(e) => { e.originalEvent.stopPropagation(); onSelectExpense(exp.id) }}
          >
            <div
              title={exp.merchant}
              style={{
                width:         size,
                height:        size,
                borderRadius:  "50%",
                backgroundColor: color,
                border:        isSelected ? "3px solid white" : `2px solid ${color}cc`,
                boxShadow:     isSelected ? "0 0 0 2px rgba(0,0,0,0.3)" : undefined,
                opacity:       isHighlighted ? 1 : 0.3,
                cursor:        "pointer",
                transition:    "all 0.15s ease",
              }}
            />
          </Marker>
        )
      })}

      {/* Insight location circles (visual ring) */}
      {insights
        .filter((i) => i.id === selectedInsightId && i.location)
        .map((insight) => (
          <Marker
            key={`insight-${insight.id}`}
            longitude={insight.location!.lng}
            latitude={insight.location!.lat}
            anchor="center"
          >
            <div
              style={{
                width:           80,
                height:          80,
                borderRadius:    "50%",
                border:          "2px dashed #6366f1",
                backgroundColor: "rgba(99, 102, 241, 0.08)",
                pointerEvents:   "none",
              }}
            />
          </Marker>
        ))}

      {/* Selected expense popup */}
      {selectedExpense && (
        <Popup
          longitude={selectedExpense.geo.lng}
          latitude={selectedExpense.geo.lat}
          anchor="bottom"
          offset={12}
          closeButton={false}
          onClose={() => onSelectExpense(null)}
        >
          <div className="text-xs min-w-36 max-w-52">
            <p className="font-semibold text-sm">{selectedExpense.merchant}</p>
            <p className="text-muted-foreground mt-0.5">
              {format(
                (selectedExpense.date as { toDate: () => Date }).toDate?.() ?? new Date(selectedExpense.date as unknown as string),
                "d MMM yyyy",
                { locale: es },
              )}
            </p>
            <p className="font-bold text-base mt-1 tabular-nums">
              {formatCurrency(selectedExpense.total)} {selectedExpense.currency}
            </p>
            {selectedExpense.category && (
              <p className="text-muted-foreground capitalize mt-0.5">{selectedExpense.category}</p>
            )}
          </div>
        </Popup>
      )}
    </Map>
  )
}
