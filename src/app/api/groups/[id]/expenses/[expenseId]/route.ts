/**
 * PATCH  /api/groups/[id]/expenses/[expenseId]  — Actualiza un gasto de grupo
 * DELETE /api/groups/[id]/expenses/[expenseId]  — Elimina un gasto de grupo
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string; expenseId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id: groupId, expenseId } = await params

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const allowed: Record<string, string> = {
    merchant:      "merchant",
    date:          "date",
    items:         "items",
    subtotal:      "subtotal",
    tax:           "tax",
    total:         "total",
    paymentMethod: "payment_method",
    reference:     "reference",
    category:      "category",
    currency:      "currency",
    notes:         "notes",
    tags:          "tags",
    splitType:     "split_type",
    splitWith:     "split_with",
    customShares:  "custom_shares",
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [camel, snake] of Object.entries(allowed)) {
    if (camel in body) patch[snake] = body[camel]
  }

  const { error } = await getSupabase()
    .from("group_expenses")
    .update(patch)
    .eq("id", expenseId)
    .eq("group_id", groupId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit log (best-effort)
  await getSupabase()
    .from("group_expense_audit")
    .insert({
      group_id:   groupId,
      expense_id: expenseId,
      action:     "updated",
      by_uid:     uid,
      by_name:    (body.paidByName as string) ?? "Usuario",
      summary:    `Editado: ${body.merchant ?? "gasto"}`.trim(),
    })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { id: groupId, expenseId } = await params

  const { error } = await getSupabase()
    .from("group_expenses")
    .delete()
    .eq("id", expenseId)
    .eq("group_id", groupId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
