/**
 * GET  /api/recurring  — Lista pagos recurrentes activos del usuario
 * POST /api/recurring  — Crea un nuevo pago recurrente
 *
 * Query params para GET:
 *   all — "true" incluye los inactivos
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToRecurring(row: Record<string, unknown>) {
  return {
    id:                   row.id,
    merchant:             row.merchant,
    category:             row.category ?? null,
    subtotal:             Number(row.subtotal),
    tax:                  Number(row.tax),
    total:                Number(row.total),
    paymentMethod:        row.payment_method ?? null,
    currency:             row.currency,
    notes:                row.notes ?? "",
    tags:                 row.tags ?? [],
    frequency:            row.frequency,
    nextDueDate:          row.next_due_date,   // DATE string "YYYY-MM-DD"
    isActive:             row.active ?? true,
    notifiedOn:           row.notified_on ?? null,
    lastLinkedExpenseId:  row.last_linked_expense_id ?? null,
    lastLinkedAt:         row.last_linked_at ?? null,
    createdAt:            row.created_at,
    priceHistory:         row.price_history ?? [],
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const all = req.nextUrl.searchParams.get("all") === "true"

  let q = getSupabase()
    .from("recurring")
    .select("*")
    .eq("uid", uid)
    .order("next_due_date", { ascending: true })

  if (!all) q = q.eq("active", true)

  const { data: rows, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((rows ?? []).map(rowToRecurring))
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
    .from("recurring")
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
      frequency:      body.frequency,
      next_due_date:  body.nextDueDate,        // "YYYY-MM-DD"
      active:         true,
      created_at:     new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data?.id }, { status: 201 })
}
