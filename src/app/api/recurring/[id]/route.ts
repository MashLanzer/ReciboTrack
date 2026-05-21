/**
 * PATCH  /api/recurring/[id]  — Actualiza un pago recurrente
 * DELETE /api/recurring/[id]  — Elimina un pago recurrente
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const allowed: Record<string, string> = {
    merchant:             "merchant",
    category:             "category",
    subtotal:             "subtotal",
    tax:                  "tax",
    total:                "total",
    paymentMethod:        "payment_method",
    currency:             "currency",
    notes:                "notes",
    tags:                 "tags",
    frequency:            "frequency",
    nextDueDate:          "next_due_date",
    isActive:             "active",
    notifiedOn:           "notified_on",
    lastLinkedExpenseId:  "last_linked_expense_id",
    lastLinkedAt:         "last_linked_at",
  }

  const patch: Record<string, unknown> = {}
  for (const [camel, snake] of Object.entries(allowed)) {
    if (camel in body) patch[snake] = body[camel]
  }

  const { error } = await getSupabase()
    .from("recurring")
    .update(patch)
    .eq("id", id)
    .eq("uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params

  const { error } = await getSupabase()
    .from("recurring")
    .delete()
    .eq("id", id)
    .eq("uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
