"use client"

import type { GeoInsight } from "@/lib/geo-patterns"
import { formatCurrency } from "@/lib/utils"
import { MapPin, TrendingUp, RotateCcw, Plane, Building2 } from "lucide-react"

const ICONS: Record<string, React.ElementType> = {
  merchant_proximity:  MapPin,
  city_budget_breaker: Building2,
  frequent_location:   RotateCcw,
  airport_trigger:     Plane,
}

interface Props {
  insights: GeoInsight[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function GeoInsightsPanel({ insights, selectedId, onSelect }: Props) {
  if (!insights.length) {
    return (
      <div className="p-4 text-center">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Sin patrones aún</p>
        <p className="text-xs text-muted-foreground mt-1">
          Añade ubicación a tus gastos para detectar patrones de comportamiento
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y">
      {insights.map((insight) => {
        const Icon      = ICONS[insight.type] ?? TrendingUp
        const isSelected = selectedId === insight.id

        return (
          <button
            key={insight.id}
            type="button"
            onClick={() => onSelect(isSelected ? null : insight.id)}
            className={`w-full text-left px-4 py-3 transition-colors flex gap-3 items-start ${
              isSelected ? "bg-primary/5" : "hover:bg-muted/50"
            }`}
          >
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              <span className="text-base">{insight.emoji}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{insight.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                {insight.description}
              </p>
              <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Icon className="h-3 w-3" />
                  {insight.occurrences} {insight.occurrences === 1 ? "vez" : "veces"}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {formatCurrency(insight.avgSpend)} promedio
                </span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
