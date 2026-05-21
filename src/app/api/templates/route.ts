/**
 * GET  /api/templates  — Lista plantillas del usuario
 * POST /api/templates  — Crea una plantilla
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToTemplate(row: Record<string, unknown>) {
  return {
    id:            row.id,
    merchant:      row.merchant,
    category:      row.category ?? null,
    subtotal:      Number(row.subtotal),
    tax:           Number(row.tax),
    total:         Number(row.total),
    paymentMethod: row.payment_method ?? null,
    currency:      row.currency ?? "USD",
    notes:         row.notes ?? "",
    tags:          row.tags ?? [],
    useCount:      Number(row.use_count ?? 0),
    createdAt:     row.created_at,
    // name campo extra (en el tipo ExpenseTemplate del cliente)
    name:          row.merchant,   // merchant sirve como nombre
    lastUsed:      null,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data: rows, error } = await getSupabase()
    .from("templates")
    .select("*")
    .eq("uid", uid)
    .order("use_count", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((rows ?? []).map(rowToTemplate))
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { data, error } = await getSupabase()
    .from("templates")
    .insert({
      uid,
      merchant:       body.merchant,
      category:       body.category ?? null,
      subtotal:       body.subtotal ?? 0,
      tax:            body.tax ?? 0,
      total:          body.total ?? 0,
      payment_method: body.paymentMethod ?? null,
      currency:       body.currency ?? "USD",
      notes:          body.notes ?? "",
      tags:           body.tags ?? [],
      use_count:      0,
      created_at:     new Date().toISOString(),
    })
    .select("id").single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data?.id }, { status: 201 })
}
