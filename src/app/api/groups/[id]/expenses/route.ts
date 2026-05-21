/**
 * GET  /api/groups/[id]/expenses  — Lista gastos del grupo
 * POST /api/groups/[id]/expenses  — Agrega un gasto al grupo
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToGroupExpense(row: Record<string, unknown>, groupId: string) {
  return {
    id:            row.id as string,
    groupId,
    merchant:      row.merchant as string,
    date:          row.date as string,
    items:         (row.items as unknown[]) ?? [],
    subtotal:      Number(row.subtotal ?? 0),
    tax:           Number(row.tax ?? 0),
    total:         Number(row.total),
    paymentMethod: (row.payment_method as string) ?? null,
    reference:     (row.reference as string) ?? null,
    category:      (row.category as string) ?? "otros",
    currency:      (row.currency as string) ?? "USD",
    notes:         (row.notes as string) ?? "",
    tags:          (row.tags as string[]) ?? [],
    paidByUid:     row.paid_by as string,
    paidByName:    (row.paid_by_name as string) ?? "",
    splitWith:     (row.split_with as string[]) ?? [],
    splitType:     (row.split_type as string) ?? "equal",
    customShares:  (row.custom_shares as Record<string, number>) ?? undefined,
    createdAt:     row.created_at as string,
    updatedAt:     row.updated_at as string,
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id: groupId } = await params

  // Verificar membresía
  const { data: group } = await getSupabase()
    .from("groups")
    .select("id")
    .eq("id", groupId)
    .contains("member_uids", [uid])
    .single()

  if (!group) return NextResponse.json({ error: "Sin acceso al grupo" }, { status: 403 })

  const { data, error } = await getSupabase()
    .from("group_expenses")
    .select("*")
    .eq("group_id", groupId)
    .order("date", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map((r) => rowToGroupExpense(r as Record<string, unknown>, groupId)))
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id: groupId } = await params

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const now = new Date().toISOString()

  const { data, error } = await getSupabase()
    .from("group_expenses")
    .insert({
      group_id:       groupId,
      paid_by:        uid,
      paid_by_name:   body.paidByName as string ?? "",
      merchant:       body.merchant as string,
      date:           body.date as string,
      items:          body.items ?? [],
      subtotal:       Number(body.subtotal ?? 0),
      tax:            Number(body.tax ?? 0),
      total:          Number(body.total),
      payment_method: body.paymentMethod ?? null,
      reference:      body.reference ?? null,
      category:       body.category ?? "otros",
      currency:       body.currency ?? "USD",
      notes:          body.notes ?? "",
      tags:           body.tags ?? [],
      split_type:     body.splitType ?? "equal",
      split_with:     body.splitWith ?? [],
      custom_shares:  body.customShares ?? null,
      created_at:     now,
      updated_at:     now,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Registrar audit log
  await getSupabase()
    .from("group_expense_audit")
    .insert({
      group_id:   groupId,
      expense_id: (data as Record<string, unknown>).id as string,
      action:     "created",
      by_uid:     uid,
      by_name:    (body.paidByName as string) ?? "Usuario",
      summary:    `Gasto creado: ${body.merchant} — ${body.total} ${body.currency}`,
    })

  return NextResponse.json(
    rowToGroupExpense(data as Record<string, unknown>, groupId),
    { status: 201 }
  )
}
