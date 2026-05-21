/**
 * GET  /api/quick-expenses  — Lista quick expenses del usuario
 * POST /api/quick-expenses  — Crea un quick expense
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToQuickExpense(row: Record<string, unknown>) {
  return {
    id:            row.id,
    label:         row.label,
    merchant:      row.merchant ?? "",
    amount:        Number(row.amount),
    category:      row.category ?? "",
    currency:      row.currency ?? "USD",
    paymentMethod: row.payment_method ?? null,
    tags:          row.tags ?? [],
    icon:          row.icon ?? "",
    order:         Number(row.sort_order ?? 0),
    createdAt:     row.created_at,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data: rows, error } = await getSupabase()
    .from("quick_expenses")
    .select("*")
    .eq("uid", uid)
    .order("sort_order", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((rows ?? []).map(rowToQuickExpense))
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
    .from("quick_expenses")
    .insert({
      uid,
      label:          body.label,
      merchant:       body.merchant ?? null,
      amount:         body.amount ?? 0,
      category:       body.category ?? null,
      currency:       body.currency ?? "USD",
      payment_method: body.paymentMethod ?? null,
      tags:           body.tags ?? [],
      icon:           body.icon ?? null,
      sort_order:     body.order ?? 0,
      created_at:     new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data?.id }, { status: 201 })
}
