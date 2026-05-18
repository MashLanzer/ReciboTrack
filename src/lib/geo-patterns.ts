/**
 * Geo Pattern Detection Engine
 * Analyzes expenses with geo data to find behavioral spending patterns.
 */

import { haversineMeters } from "./geocoding"
import type { Expense } from "@/types"

export type InsightType =
  | "merchant_proximity"    // "Cuando estás cerca de X, sueles gastar $Y"
  | "city_budget_breaker"   // "Esta ciudad rompe tu presupuesto"
  | "frequent_location"     // "Punto de gasto frecuente"
  | "airport_trigger"       // "Los viajes desde este aeropuerto disparan gastos"

export interface GeoInsight {
  id: string
  type: InsightType
  title: string
  description: string
  emoji: string
  location: { lat: number; lng: number; radiusMeters: number } | null
  cityName: string | null
  merchantName: string | null
  avgSpend: number
  totalSpend: number
  occurrences: number
  relatedExpenseIds: string[]
  generatedAt: string
}

export type GeoExpense = Expense & {
  geo: { lat: number; lng: number; accuracy?: number }
  cityName?: string | null
  countryCode?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDate(val: unknown): Date {
  if (val && typeof val === "object" && "toDate" in val) return (val as { toDate: () => Date }).toDate()
  if (typeof val === "string" || typeof val === "number") return new Date(val)
  return new Date()
}

function expensesWithGeo(expenses: Expense[]): GeoExpense[] {
  return expenses.filter(
    (e): e is GeoExpense => !!(e as GeoExpense).geo?.lat && !!(e as GeoExpense).geo?.lng,
  )
}

// ── Pattern 1: Merchant proximity ─────────────────────────────────────────────

function merchantProximityInsights(geoExpenses: GeoExpense[]): GeoInsight[] {
  const insights: GeoInsight[] = []

  // Group by merchant name (normalized)
  const byMerchant = new Map<string, GeoExpense[]>()
  geoExpenses.forEach((e) => {
    const key = e.merchant.trim().toLowerCase()
    const arr = byMerchant.get(key) ?? []
    arr.push(e)
    byMerchant.set(key, arr)
  })

  byMerchant.forEach((exps, merchantKey) => {
    if (exps.length < 3) return  // Need at least 3 visits

    const totals  = exps.map((e) => e.total)
    const avgSpend  = totals.reduce((s, n) => s + n, 0) / totals.length
    const totalSpend = totals.reduce((s, n) => s + n, 0)

    // Find centroid
    const centLat = exps.reduce((s, e) => s + e.geo.lat, 0) / exps.length
    const centLng = exps.reduce((s, e) => s + e.geo.lng, 0) / exps.length

    const merchantName = exps[0].merchant

    insights.push({
      id:          `mp_${merchantKey.replace(/\s+/g, "_")}`,
      type:        "merchant_proximity",
      title:       `${merchantName}`,
      description: `Cuando estás cerca de ${merchantName} sueles gastar ${formatAmt(avgSpend, exps[0].currency)}. Lo has visitado ${exps.length} veces.`,
      emoji:       "📍",
      location:    { lat: centLat, lng: centLng, radiusMeters: 500 },
      cityName:    exps[0].cityName ?? null,
      merchantName,
      avgSpend,
      totalSpend,
      occurrences:        exps.length,
      relatedExpenseIds:  exps.map((e) => e.id),
      generatedAt:        new Date().toISOString(),
    })
  })

  return insights
}

// ── Pattern 2: City budget breaker ────────────────────────────────────────────

function cityBudgetInsights(geoExpenses: GeoExpense[]): GeoInsight[] {
  const insights: GeoInsight[] = []

  // Group by city
  const byCity = new Map<string, GeoExpense[]>()
  geoExpenses.forEach((e) => {
    const city = e.cityName ?? "desconocida"
    const arr  = byCity.get(city) ?? []
    arr.push(e)
    byCity.set(city, arr)
  })

  if (byCity.size < 2) return []  // Need at least 2 cities to compare

  // Compute per-city daily spend
  const cityStats = new Map<string, { totalPerDay: number; total: number; count: number; exps: GeoExpense[] }>()
  byCity.forEach((exps, city) => {
    if (exps.length < 2) return
    const dates   = exps.map((e) => toDate(e.date).getTime())
    const span    = Math.max((Math.max(...dates) - Math.min(...dates)) / 86_400_000, 1)
    const total   = exps.reduce((s, e) => s + e.total, 0)
    cityStats.set(city, { totalPerDay: total / span, total, count: exps.length, exps })
  })

  if (cityStats.size < 2) return []

  const avgDailyAcrossAll = [...cityStats.values()].reduce((s, v) => s + v.totalPerDay, 0) / cityStats.size

  cityStats.forEach(({ totalPerDay, total, count, exps }, city) => {
    if (totalPerDay > avgDailyAcrossAll * 1.7 && count >= 3) {
      const centLat = exps.reduce((s, e) => s + e.geo.lat, 0) / exps.length
      const centLng = exps.reduce((s, e) => s + e.geo.lng, 0) / exps.length
      const pct     = Math.round((totalPerDay / avgDailyAcrossAll - 1) * 100)

      insights.push({
        id:          `city_${city.toLowerCase().replace(/\s+/g, "_")}`,
        type:        "city_budget_breaker",
        title:       city,
        description: `En ${city} gastas un ${pct}% más que tu promedio diario en otras ciudades. Total registrado: ${formatAmt(total, exps[0].currency)}.`,
        emoji:       "🌆",
        location:    { lat: centLat, lng: centLng, radiusMeters: 5000 },
        cityName:    city,
        merchantName: null,
        avgSpend:    totalPerDay,
        totalSpend:  total,
        occurrences: count,
        relatedExpenseIds: exps.map((e) => e.id),
        generatedAt: new Date().toISOString(),
      })
    }
  })

  return insights
}

// ── Pattern 3: Frequent location clusters ────────────────────────────────────

function frequentLocationInsights(geoExpenses: GeoExpense[]): GeoInsight[] {
  const insights: GeoInsight[] = []
  const RADIUS     = 200  // meters
  const MIN_VISITS = 4
  const used       = new Set<string>()

  geoExpenses.forEach((anchor, i) => {
    if (used.has(anchor.id)) return

    // Find neighbours in 200m radius with distinct dates
    const neighbours = geoExpenses.filter((e, j) => {
      if (j === i) return false
      const dist = haversineMeters(anchor.geo, e.geo)
      return dist <= RADIUS
    })

    // Count distinct visit dates
    const visitDates = new Set([
      toDate(anchor.date).toDateString(),
      ...neighbours.map((e) => toDate(e.date).toDateString()),
    ])

    if (visitDates.size < MIN_VISITS) return

    const cluster   = [anchor, ...neighbours]
    const totalSpend = cluster.reduce((s, e) => s + e.total, 0)
    const avgSpend  = totalSpend / cluster.length

    cluster.forEach((e) => used.add(e.id))

    insights.push({
      id:          `fl_${anchor.id}`,
      type:        "frequent_location",
      title:       "Punto de gasto frecuente",
      description: `Tienes ${visitDates.size} visitas en este lugar. Gasto promedio ${formatAmt(avgSpend, anchor.currency)} por visita.`,
      emoji:       "🔁",
      location:    { lat: anchor.geo.lat, lng: anchor.geo.lng, radiusMeters: RADIUS },
      cityName:    anchor.cityName ?? null,
      merchantName: null,
      avgSpend,
      totalSpend,
      occurrences:       visitDates.size,
      relatedExpenseIds: cluster.map((e) => e.id),
      generatedAt:       new Date().toISOString(),
    })
  })

  return insights
}

// ── Pattern 4: Airport trigger ────────────────────────────────────────────────

const AIRPORT_KEYWORDS = ["aeropuerto", "airport", "aeroport", "terminal", "vuelo", "flight"]

function airportTriggerInsights(geoExpenses: GeoExpense[]): GeoInsight[] {
  const insights: GeoInsight[] = []

  const airportExpenses = geoExpenses.filter((e) =>
    AIRPORT_KEYWORDS.some((kw) => e.merchant.toLowerCase().includes(kw)) ||
    AIRPORT_KEYWORDS.some((kw) => (e.category ?? "").toLowerCase().includes(kw)),
  )

  if (airportExpenses.length < 3) return []

  // Group airport visits (within 24h window)
  const trips: GeoExpense[][] = []
  const sorted = [...airportExpenses].sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime())

  sorted.forEach((exp) => {
    const lastTrip = trips[trips.length - 1]
    const lastDate = lastTrip ? toDate(lastTrip[lastTrip.length - 1].date).getTime() : 0
    const thisDate = toDate(exp.date).getTime()
    if (lastTrip && thisDate - lastDate < 48 * 3_600_000) {
      lastTrip.push(exp)
    } else {
      trips.push([exp])
    }
  })

  if (trips.length < 2) return []

  // For each trip, sum all expenses within 48h after airport
  const triggerStats = trips.map((trip) => {
    const start = toDate(trip[0].date).getTime()
    const end   = start + 48 * 3_600_000
    const triggered = geoExpenses.filter((e) => {
      const t = toDate(e.date).getTime()
      return t >= start && t <= end
    })
    return triggered.reduce((s, e) => s + e.total, 0)
  })

  const avgTrigger = triggerStats.reduce((s, n) => s + n, 0) / triggerStats.length
  const anchor     = airportExpenses[0]

  insights.push({
    id:          "airport_trigger",
    type:        "airport_trigger",
    title:       "Viajes en avión",
    description: `Cuando viajas en avión sueles gastar ${formatAmt(avgTrigger, anchor.currency)} en las 48h siguientes. Patrón detectado en ${trips.length} viajes.`,
    emoji:       "✈️",
    location:    null,
    cityName:    null,
    merchantName: null,
    avgSpend:    avgTrigger,
    totalSpend:  triggerStats.reduce((s, n) => s + n, 0),
    occurrences: trips.length,
    relatedExpenseIds: airportExpenses.map((e) => e.id),
    generatedAt: new Date().toISOString(),
  })

  return insights
}

// ── Main entrypoint ───────────────────────────────────────────────────────────

export function detectGeoPatterns(expenses: Expense[]): GeoInsight[] {
  const geo = expensesWithGeo(expenses)
  if (geo.length < 3) return []

  return [
    ...merchantProximityInsights(geo),
    ...cityBudgetInsights(geo),
    ...frequentLocationInsights(geo),
    ...airportTriggerInsights(geo),
  ].sort((a, b) => b.occurrences - a.occurrences)
}

// ── Format helper ─────────────────────────────────────────────────────────────

function formatAmt(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("es", { style: "currency", currency, maximumFractionDigits: 0 }).format(n)
}
