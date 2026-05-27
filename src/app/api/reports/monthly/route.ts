/**
 * GET /api/reports/monthly?year=2026&month=5
 * Devuelve los datos del reporte mensual en JSON.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const sp = req.nextUrl.searchParams
  const year  = parseInt(sp.get("year")  ?? String(new Date().getFullYear()), 10)
  const month = parseInt(sp.get("month") ?? String(new Date().getMonth() + 1), 10)

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Parámetros year/month inválidos" }, { status: 400 })
  }

  // Calcular rango de fechas del mes
  const startDate = new Date(year, month - 1, 1).toISOString().split("T")[0]
  const endDate   = new Date(year, month, 0).toISOString().split("T")[0]

  const sb = getSupabase()

  // Obtener gastos del mes
  const { data: rows, error } = await sb
    .from("expenses")
    .select("id, merchant, date, total, category, currency, notes, tags, payment_method, account")
    .eq("uid", uid)
    .eq("archived", false)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Obtener presupuestos por categoría (si existen)
  const { data: budgetRows } = await sb
    .from("category_budgets")
    .select("category_id, amount, currency")
    .eq("uid", uid)

  const budgetMap: Record<string, number> = {}
  for (const b of budgetRows ?? []) {
    budgetMap[b.category_id as string] = Number(b.amount)
  }

  // Obtener ingresos del mes (tabla income — puede no existir)
  let totalIncome = 0
  try {
    const { data: incomeRows } = await sb
      .from("income")
      .select("amount")
      .eq("uid", uid)
      .gte("date", startDate)
      .lte("date", endDate)

    totalIncome = (incomeRows ?? []).reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.amount ?? 0), 0)
  } catch {
    // La tabla income puede no existir — ignorar
  }

  const expenses = rows ?? []
  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.total), 0)
  const currency   = expenses[0]?.currency ?? "USD"

  // Agrupar por categoría
  const catMap: Record<string, { name: string; amount: number; budget: number | null; expenses: typeof expenses }> = {}

  for (const e of expenses) {
    const cat = (e.category as string) || "Sin categoría"
    if (!catMap[cat]) {
      catMap[cat] = {
        name:     cat,
        amount:   0,
        budget:   budgetMap[cat] ?? null,
        expenses: [],
      }
    }
    catMap[cat].amount += Number(e.total)
    catMap[cat].expenses.push(e)
  }

  const categories = Object.values(catMap)
    .sort((a, b) => b.amount - a.amount)
    .map((c) => ({
      name:       c.name,
      amount:     parseFloat(c.amount.toFixed(2)),
      percentage: totalSpent > 0 ? parseFloat(((c.amount / totalSpent) * 100).toFixed(1)) : 0,
      budget:     c.budget,
      expenses:   c.expenses.map((e) => ({
        id:            e.id,
        merchant:      e.merchant,
        date:          e.date,
        total:         Number(e.total),
        paymentMethod: e.payment_method ?? null,
        notes:         e.notes ?? "",
        account:       e.account ?? "personal",
      })),
    }))

  return NextResponse.json({
    year,
    month,
    totalSpent: parseFloat(totalSpent.toFixed(2)),
    totalIncome: parseFloat(totalIncome.toFixed(2)),
    netBalance:  parseFloat((totalIncome - totalSpent).toFixed(2)),
    currency,
    categories,
  })
}
