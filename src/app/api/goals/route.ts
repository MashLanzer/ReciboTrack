/**
 * GET  /api/goals  — Lista metas del usuario
 * POST /api/goals  — Crea una nueva meta
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToGoal(row: Record<string, unknown>) {
  return {
    id:            row.id,
    type:          row.type,
    name:          row.name,
    targetAmount:  Number(row.target_amount),
    currentAmount: Number(row.current_amount),
    currency:      row.currency,
    deadline:      row.deadline ?? null,
    isActive:      row.is_active ?? true,
    createdAt:     row.created_at,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data: rows, error } = await getSupabase()
    .from("goals")
    .select("*")
    .eq("uid", uid)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((rows ?? []).map(rowToGoal))
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

  const { data, error } = await getSupabase()
    .from("goals")
    .insert({
      uid,
      type:           body.type ?? "saving",
      name:           body.name,
      target_amount:  body.targetAmount,
      current_amount: body.currentAmount ?? 0,
      currency:       body.currency ?? "USD",
      deadline:       body.deadline ?? null,
      is_active:      true,
      created_at:     new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data?.id }, { status: 201 })
}
