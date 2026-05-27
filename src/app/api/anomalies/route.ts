/**
 * GET /api/anomalies
 *
 * Detecta gastos inusuales de los últimos 7 días comparándolos con el
 * promedio de los últimos 90 días por categoría.
 *
 * Un gasto se considera anómalo si su importe supera 2.5x el promedio
 * histórico de su categoría.
 *
 * Returns:
 *   { anomalies: Array<{ id, description, amount, currency, category, date, avgForCategory, ratio }> }
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const sb = getSupabase()
  const now = new Date()

  // ── 1. Gastos últimos 90 días ─────────────────────────────────────────────
  const start90 = new Date(now)
  start90.setDate(start90.getDate() - 90)

  const { data: history, error: histError } = await sb
    .from("expenses")
    .select("id, category, total")
    .eq("uid", uid)
    .eq("archived", false)
    .gte("date", start90.toISOString())
    .lte("date", now.toISOString())

  if (histError) {
    console.error("[anomalies] history query error:", histError)
    return NextResponse.json({ error: "Error al obtener historial" }, { status: 500 })
  }

  // ── 2. Calcular promedio por categoría ────────────────────────────────────
  const catTotals = new Map<string, number[]>()

  for (const row of history ?? []) {
    const cat = row.category as string
    const total = Number(row.total)
    if (!catTotals.has(cat)) catTotals.set(cat, [])
    catTotals.get(cat)!.push(total)
  }

  const catAvg = new Map<string, number>()
  for (const [cat, amounts] of catTotals) {
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length
    catAvg.set(cat, avg)
  }

  // ── 3. Gastos últimos 7 días ──────────────────────────────────────────────
  const start7 = new Date(now)
  start7.setDate(start7.getDate() - 7)

  const { data: recent, error: recentError } = await sb
    .from("expenses")
    .select("id, merchant, total, currency, category, date, notes")
    .eq("uid", uid)
    .eq("archived", false)
    .gte("date", start7.toISOString())
    .lte("date", now.toISOString())
    .order("date", { ascending: false })

  if (recentError) {
    console.error("[anomalies] recent query error:", recentError)
    return NextResponse.json({ error: "Error al obtener gastos recientes" }, { status: 500 })
  }

  // ── 4. Detectar anomalías ─────────────────────────────────────────────────
  const THRESHOLD = 2.5

  type RecentRow = {
    id: string
    merchant: string
    total: number
    currency: string
    category: string
    date: string
    notes: string | null
  }

  const anomalies = (recent as RecentRow[] ?? [])
    .filter((row) => {
      const avg = catAvg.get(row.category)
      if (!avg || avg < 5) return false // ignora categorías con promedio muy bajo
      return Number(row.total) > avg * THRESHOLD
    })
    .map((row) => {
      const avg = catAvg.get(row.category)!
      return {
        id:             row.id,
        description:    row.merchant,
        amount:         Number(row.total),
        currency:       row.currency,
        category:       row.category,
        date:           row.date,
        avgForCategory: avg,
        ratio:          Math.round((Number(row.total) / avg) * 100) / 100,
      }
    })

  return NextResponse.json({ anomalies })
}
