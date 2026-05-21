/**
 * GET  /api/budgets  — Lista presupuestos del usuario
 * POST /api/budgets  — Crea o actualiza un presupuesto (upsert por categoryId)
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToBudget(row: Record<string, unknown>) {
  return {
    id:           row.id,
    categoryId:   row.category_id,
    monthlyLimit: Number(row.monthly_limit),
    currency:     row.currency,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data: rows, error } = await getSupabase()
    .from("budgets")
    .select("*")
    .eq("uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((rows ?? []).map(rowToBudget))
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

  const sb = getSupabase()

  // Si tiene id, actualizar directamente
  if (body.id) {
    const { error } = await sb
      .from("budgets")
      .update({
        monthly_limit: body.monthlyLimit,
        currency:      body.currency ?? "USD",
      })
      .eq("id", body.id)
      .eq("uid", uid)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: body.id })
  }

  // Si no tiene id, buscar si ya existe por categoryId (upsert)
  const { data: existing } = await sb
    .from("budgets")
    .select("id")
    .eq("uid", uid)
    .eq("category_id", body.categoryId)
    .single()

  if (existing?.id) {
    const { error } = await sb
      .from("budgets")
      .update({
        monthly_limit: body.monthlyLimit,
        currency:      body.currency ?? "USD",
      })
      .eq("id", existing.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: existing.id })
  }

  // Crear nuevo
  const { data, error } = await sb
    .from("budgets")
    .insert({
      uid,
      category_id:   body.categoryId,
      monthly_limit: body.monthlyLimit,
      currency:      body.currency ?? "USD",
      created_at:    new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data?.id }, { status: 201 })
}
