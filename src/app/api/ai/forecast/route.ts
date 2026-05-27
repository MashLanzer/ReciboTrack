import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns"
import { es } from "date-fns/locale"

interface ExpenseRow {
  total: number
  category: string
  currency: string
  date: string
}

type Trend = "up" | "down" | "stable"

const TREND_FACTOR: Record<Trend, number> = {
  up: 1.05,
  down: 0.95,
  stable: 1.0,
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const now = new Date()
  const start = startOfMonth(subMonths(now, 3))
  const end = endOfMonth(subMonths(now, 1))

  const sb = getSupabase()
  const { data: rows, error } = await sb
    .from("expenses")
    .select("total, category, currency, date")
    .eq("uid", uid)
    .eq("archived", false)
    .gte("date", start.toISOString())
    .lte("date", end.toISOString())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const expenses = (rows ?? []) as ExpenseRow[]

  const currency = expenses.find(e => e.currency)?.currency ?? "USD"

  const monthBuckets: Record<string, Record<string, number>> = {}
  for (let i = 3; i >= 1; i--) {
    const key = format(subMonths(now, i), "yyyy-MM")
    monthBuckets[key] = {}
  }

  for (const e of expenses) {
    const monthKey = e.date.slice(0, 7)
    if (!(monthKey in monthBuckets)) continue
    const cat = e.category || "Sin categoría"
    monthBuckets[monthKey][cat] = (monthBuckets[monthKey][cat] ?? 0) + e.total
  }

  const allCategories = new Set<string>()
  for (const bucket of Object.values(monthBuckets)) {
    for (const cat of Object.keys(bucket)) allCategories.add(cat)
  }

  const monthKeys = Object.keys(monthBuckets).sort()
  const [m3Key, m2Key, m1Key] = monthKeys

  const categoryForecasts: Map<string, { predicted: number[]; trend: Trend }> = new Map()

  for (const cat of allCategories) {
    const m3 = monthBuckets[m3Key]?.[cat] ?? 0
    const m2 = monthBuckets[m2Key]?.[cat] ?? 0
    const m1 = monthBuckets[m1Key]?.[cat] ?? 0

    let trend: Trend = "stable"
    if (m3 > 0) {
      if (m1 > m3 * 1.1) trend = "up"
      else if (m1 < m3 * 0.9) trend = "down"
    } else if (m1 > 0) {
      trend = "up"
    }

    const avg = (m3 + m2 + m1) / 3
    const factor = TREND_FACTOR[trend]

    const p0 = avg * factor
    const p1 = p0 * factor
    const p2 = p1 * factor

    categoryForecasts.set(cat, {
      predicted: [
        Math.round(p0 * 100) / 100,
        Math.round(p1 * 100) / 100,
        Math.round(p2 * 100) / 100,
      ],
      trend,
    })
  }

  const forecastMonths = [0, 1, 2].map((offset) => {
    const monthDate = subMonths(now, -1 - offset)
    const monthName = format(monthDate, "MMMM yyyy", { locale: es })
    const categories = Array.from(categoryForecasts.entries()).map(([category, { predicted, trend }]) => ({
      category,
      predicted: predicted[offset],
      trend,
    }))
    return { month: monthName, categories }
  })

  const totalPredicted = [0, 1, 2].map((offset) =>
    Math.round(
      Array.from(categoryForecasts.values()).reduce((sum, { predicted }) => sum + predicted[offset], 0) * 100
    ) / 100
  )

  return NextResponse.json({ forecast: forecastMonths, totalPredicted, currency })
}
