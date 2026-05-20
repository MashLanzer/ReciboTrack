"use client"

import dynamic from "next/dynamic"
import { useState, useMemo, useEffect } from "react"
import { useExpensesPeriod } from "@/hooks/use-expenses"
import { useGeoInsights } from "@/hooks/use-geo-insights"
import { GeoInsightsPanel } from "@/components/map/geo-insights-panel"
import { formatCurrency } from "@/lib/utils"
import { subMonths } from "date-fns"
import { MapPin, Lightbulb, Loader2, ShieldOff, ExternalLink } from "lucide-react"
import type { Expense } from "@/types"

// #29 — Skeleton con shimmer mientras carga MapLibre (paquete pesado)
function MapLoadingSkeleton() {
  return (
    <div className="h-full rounded-2xl border overflow-hidden relative bg-muted/30 animate-pulse">
      {/* Fake map tiles grid */}
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 gap-px opacity-20">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="bg-muted-foreground/10" />
        ))}
      </div>
      {/* Center pin indicator */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted-foreground/15 flex items-center justify-center">
          <MapPin className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <div className="h-3 w-24 rounded-full bg-muted-foreground/15" />
      </div>
    </div>
  )
}

// Dynamic import — MapLibre is heavy and must be client-only
const ExpenseMap = dynamic(
  () => import("@/components/map/expense-map").then((m) => m.ExpenseMap),
  {
    ssr: false,
    loading: () => <MapLoadingSkeleton />,
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
  const [geoPermission, setGeoPermission]           = useState<PermissionState | null>(null)

  // Check geolocation permission state on mount (and listen for changes)
  useEffect(() => {
    if (typeof window === "undefined" || !("permissions" in navigator)) return
    let status: PermissionStatus | null = null
    navigator.permissions.query({ name: "geolocation" }).then((s) => {
      status = s
      setGeoPermission(s.state)
      s.onchange = () => setGeoPermission(s.state)
    }).catch(() => { /* Permissions API not supported */ })
    return () => { if (status) status.onchange = null }
  }, [])

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
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
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
            <MapLoadingSkeleton />
          ) : !hasGeoData && geoPermission === "denied" ? (
            <div className="h-full flex items-center justify-center bg-muted/10 rounded-2xl border border-dashed p-6">
              <GeoPermissionDenied />
            </div>
          ) : !hasGeoData ? (
            // #13 — Mensaje explícito cuando hay permiso pero ningún gasto tiene coordenadas
            <div className="h-full flex items-center justify-center bg-muted/10 rounded-2xl border border-dashed p-6">
              <div className="flex flex-col items-center text-center gap-4 max-w-xs mx-auto animate-[fadeSlideUp_0.25s_ease-out_both]">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center text-2xl">
                  📍
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold">Ningún gasto tiene ubicación</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Tus gastos no tienen coordenadas guardadas. Al añadir un gasto, activa el botón
                    de ubicación <span className="font-medium">📍</span> para que aparezca aquí.
                  </p>
                </div>
              </div>
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

          {/* No geo data / permission fallback */}
          {!hasGeoData && !isLoading && (
            geoPermission === "denied" ? (
              <GeoPermissionDenied />
            ) : (
              <div className="rounded-2xl border bg-muted/30 p-4 text-center">
                <p className="text-2xl mb-2">📍</p>
                <p className="text-sm font-medium">Activa ubicación al registrar gastos</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Toca el botón 📍 en el formulario de nuevo gasto para capturar la ubicación
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

// ── Geolocation denied fallback ───────────────────────────────────────────────

function GeoPermissionDenied() {
  // Detect OS to give the right browser-settings path
  const isIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent)
  const hint = isIOS
    ? "Ve a Ajustes → Privacidad → Localización → tu navegador"
    : "Haz clic en el candado 🔒 en la barra de dirección → Permisos del sitio → Ubicación"

  return (
    <div className="flex flex-col items-center text-center gap-4 max-w-xs mx-auto
      animate-[fadeSlideUp_0.25s_ease-out_both]">
      <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <ShieldOff className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">Ubicación bloqueada</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Permitiste que el navegador bloquee la ubicación para este sitio. Los gastos futuros no
          podrán capturar coordenadas.
        </p>
      </div>
      <div className="rounded-xl border bg-muted/40 px-4 py-3 text-left space-y-1 w-full">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Cómo volver a activarla
        </p>
        <p className="text-xs text-foreground/80 leading-relaxed">{hint}</p>
      </div>
      <a
        href="https://support.google.com/chrome/answer/142065"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline underline-offset-2"
      >
        <ExternalLink className="h-3 w-3" />
        Ver ayuda del navegador
      </a>
    </div>
  )
}

// ── City breakdown ────────────────────────────────────────────────────────────

const CITIES_INITIAL = 5

function CityBreakdown({ expenses }: { expenses: GeoExpense[] }) {
  const [showAll, setShowAll] = useState(false)

  const allCityData = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>()
    expenses.forEach((e) => {
      const city = (e as GeoExpense & { cityName?: string }).cityName ?? "Sin ciudad"
      const prev = map.get(city) ?? { total: 0, count: 0 }
      map.set(city, { total: prev.total + e.total, count: prev.count + 1 })
    })
    return [...map.entries()]
      .map(([city, v]) => ({ city, ...v }))
      .sort((a, b) => b.total - a.total)
  }, [expenses])

  // #14 — Mostrar solo las primeras N ciudades, con botón "ver más"
  const cityData = showAll ? allCityData : allCityData.slice(0, CITIES_INITIAL)
  const hasMore = allCityData.length > CITIES_INITIAL
  const maxTotal = allCityData[0]?.total ?? 1

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
      {hasMore && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors pt-1 underline-offset-2 hover:underline"
        >
          {showAll
            ? "Ver menos"
            : `Ver ${allCityData.length - CITIES_INITIAL} ciudad${allCityData.length - CITIES_INITIAL !== 1 ? "es" : ""} más`}
        </button>
      )}
    </div>
  )
}
