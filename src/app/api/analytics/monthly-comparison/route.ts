/**
 * GET /api/analytics/monthly-comparison
 * Returns last 6 months of spending grouped by the top 5 categories.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"
import { startOfMonth, subMonths, format } from "date-fns"
import { es } from "date-fns/locale"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const sb = getSupabase()
  const now = new Date()

  // First day of 6 months ago
  const startDate = startOfMonth(subMonths(now, 5)).toISOString()

  const { data: rows, error } = await sb
    .from("expenses")
    .select("date, category, total")
    .eq("uid", uid)
    .eq("archived", false)
    .gte("date", startDate)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Build month labels for the last 6 months (oldest → newest)
  const monthKeys: string[] = []   // "yyyy-MM" format for grouping
  const monthLabels: string[] = [] // display labels e.g. "may 26"

  for (let i = 5; i >= 0; i--) {
    const d = subMonths(now, i)
    monthKeys.push(format(d, "yyyy-MM"))
    monthLabels.push(format(d, "MMM yy", { locale: es }))
  }

  // Group totals: categoryTotals[category][monthKey] = sum
  const categoryTotals: Record<string, Record<string, number>> = {}
  const categoryGrand: Record<string, number> = {}

  for (const row of rows ?? []) {
    const cat = (row.category as string) || "Otros"
    const total = Number(row.total) || 0
    const monthKey = (row.date as string).slice(0, 7) // "yyyy-MM"

    if (!monthKeys.includes(monthKey)) continue

    if (!categoryTotals[cat]) {
      categoryTotals[cat] = {}
      categoryGrand[cat] = 0
    }
    categoryTotals[cat][monthKey] = (categoryTotals[cat][monthKey] ?? 0) + total
    categoryGrand[cat] += total
  }

  // Pick top 5 categories by total spend across all 6 months
  const topCategories = Object.entries(categoryGrand)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat]) => cat)

  // Build data object
  const data: Record<string, number[]> = {}
  for (const cat of topCategories) {
    data[cat] = monthKeys.map((mk) => Math.round((categoryTotals[cat]?.[mk] ?? 0) * 100) / 100)
  }

  // Detect currency from the first expense (fallback "MXN")
  const { data: currencyRow } = await sb
    .from("expenses")
    .select("currency")
    .eq("uid", uid)
    .limit(1)
    .single()

  const currency = (currencyRow as { currency?: string } | null)?.currency ?? "MXN"

  return NextResponse.json({
    months: monthLabels,
    categories: topCategories,
    data,
    currency,
  })
}
