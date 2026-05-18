"use client"

import dynamic from "next/dynamic"
import { useState, useMemo } from "react"
import { useExpensesPeriod } from "@/hooks/use-expenses"
import { useGeoInsights } from "@/hooks/use-geo-insights"
import { GeoInsightsPanel } from "@/components/map/geo-insights-panel"
import { formatCurrency } from "@/lib/utils"
import { subMonths } from "date-fns"
import { MapPin, Lightbulb, Loader2, TrendingUp } from "lucide-react"
import type { Expense } from "@/types"

// Dynamic import — MapLibre is heavy and must be client-only
const ExpenseMap = dynamic(
  () => import("@/components/map/expense-map").then((m) => m.ExpenseMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-muted/20 rounded-2xl border">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    ),
  },
)

type GeoExpense = Expense & { geo: { lat: number; lng: number } }

export default function MapPage() {
  const now           = useMemo(() => new Date(), [])
  const sixMonthsAgo  = useMemo(() => subMonths(now, 6), [now])

  const { data: expenses = [], isLoading } = useExpensesPeriod(sixMonthsAgo, now)
  const { insights, hasGeoData }           = useGeoInsights()

  const [selectedInsightId, setSelectedInsightId]   = useState<string | null>(null)
  const [selectedExpenseId, setSelectedExpenseId]   = useState<string | null>(null)
  const [activePanel, setActivePanel]               = useState<"map" | "insights">("map")

  const geoExpenses = useMemo(
    () => expenses.filter((e): e is GeoExpense => !!(e as GeoExpense).geo?.lat),
    [expenses],
  )

  const totalGeoAmount = useMemo(
    () => geoExpenses.reduce((s, e) => s + e.total, 0),
    [geoExpenses],
  )

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] max-w-5xl mx-auto px-4 py-4 gap-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Mapa de gastos
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading
              ? "Cargando…"
              : hasGeoData
                ? `${geoExpenses.length} gastos con ubicación · ${formatCurrency(totalGeoAmount)}`
                : "Añade ubicación a tus gastos para ver el mapa"
            }
          </p>
        </div>

        {/* Mobile tab switcher */}
        <div className="flex rounded-xl border p-0.5 bg-muted/30 sm:hidden">
          <button
            type="button"
            onClick={() => setActivePanel("map")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activePanel === "map" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            <MapPin className="h-3.5 w-3.5" /> Mapa
          </button>
          <button
            type="button"
            onClick={() => setActivePanel("insights")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 relative ${
              activePanel === "insights" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Lightbulb className="h-3.5 w-3.5" /> Patrones
            {insights.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">
                {insights.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Map */}
        <div className={`flex-1 min-h-0 rounded-2xl overflow-hidden ${activePanel !== "map" ? "hidden sm:block" : ""}`}>
          {isLoading ? (
            <div className="h-full flex items-center justify-center bg-muted/20 rounded-2xl border">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ExpenseMap
              expenses={expenses}
              insights={insights}
              selectedInsightId={selectedInsightId}
              selectedExpenseId={selectedExpenseId}
              onSelectExpense={setSelectedExpenseId}
            />
          )}
        </div>

        {/* Sidebar — insights + city stats */}
        <div className={`w-full sm:w-80 shrink-0 flex flex-col gap-3 overflow-y-auto ${activePanel !== "insights" ? "hidden sm:flex" : "flex"}`}>

          {/* Insights panel */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              <p className="text-sm font-semibold">Patrones detectados</p>
              {insights.length > 0 && (
                <span className="ml-auto text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
                  {insights.length}
                </span>
              )}
            </div>
            <GeoInsightsPanel
              insights={insights}
              selectedId={selectedInsightId}
              onSelect={(id) => {
                setSelectedInsightId(id)
                setActivePanel("map")
              }}
            />
          </div>

          {/* Quick stats */}
          {geoExpenses.length > 0 && (
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Resumen de ubicaciones
              </p>

              {/* Top cities */}
              <CityBreakdown expenses={geoExpenses} />
            </div>
          )}

          {/* No geo data hint */}
          {!hasGeoData && !isLoading && (
            <div className="rounded-2xl border bg-muted/30 p-4 text-center">
              <p className="text-2xl mb-2">📍</p>
              <p className="text-sm font-medium">Activa ubicación al registrar gastos</p>
              <p className="text-xs text-muted-foreground mt-1">
                Toca el botón 📍 en el formulario de nuevo gasto para capturar la ubicación
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── City breakdown ────────────────────────────────────────────────────────────

function CityBreakdown({ expenses }: { expenses: GeoExpense[] }) {
  const cityData = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>()
    expenses.forEach((e) => {
      const city = (e as GeoExpense & { cityName?: string }).cityName ?? "Sin ciudad"
      const prev = map.get(city) ?? { total: 0, count: 0 }
      map.set(city, { total: prev.total + e.total, count: prev.count + 1 })
    })
    return [...map.entries()]
      .map(([city, v]) => ({ city, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [expenses])

  const maxTotal = cityData[0]?.total ?? 1

  return (
    <div className="space-y-2">
      {cityData.map(({ city, total, count }) => (
        <div key={city}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium truncate">{city}</span>
            <span className="text-muted-foreground shrink-0 ml-2">
              {count} gasto{count !== 1 ? "s" : ""} · {formatCurrency(total)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary/70 transition-all"
              style={{ width: `${(total / maxTotal) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
