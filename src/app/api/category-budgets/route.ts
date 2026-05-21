/**
 * GET  /api/category-budgets?month=YYYY-MM  — Lista presupuestos por categoría para un mes
 * POST /api/category-budgets               — Crea/actualiza un presupuesto por categoría (upsert)
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const month = req.nextUrl.searchParams.get("month") ?? ""

  let q = getSupabase().from("category_budgets").select("*").eq("uid", uid)
  if (month) q = q.eq("month", month)

  const { data: rows, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const mapped = (rows ?? []).map((row: Record<string, unknown>) => ({
    id:         row.budget_key as string,  // budget_key IS the doc id
    categoryId: row.category_id,
    amount:     Number(row.amount),
    currency:   row.currency,
    month:      row.month,
  }))

  return NextResponse.json(mapped)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const budgetKey = `${body.categoryId}_${body.month}`

  const { error } = await getSupabase()
    .from("category_budgets")
    .upsert({
      uid,
      budget_key:  budgetKey,
      category_id: body.categoryId,
      month:       body.month,
      amount:      body.amount,
      currency:    body.currency ?? "USD",
    }, { onConflict: "uid,budget_key" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: budgetKey })
}
