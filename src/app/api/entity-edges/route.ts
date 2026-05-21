/**
 * GET  /api/entity-edges?expenseId=...  — Lista edges (filtro opcional por gasto)
 * POST /api/entity-edges                — Crea un edge y actualiza stats de la entidad
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToEdge(row: Record<string, unknown>) {
  return {
    id:        row.id as string,
    fromId:    row.from_id as string,
    toId:      row.to_id as string,
    type:      row.type as string,
    expenseId: row.expense_id as string,
    weight:    Number(row.weight ?? 0),
    createdAt: row.created_at as string,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { searchParams } = new URL(req.url)
  const expenseId = searchParams.get("expenseId")

  let q = getSupabase()
    .from("entity_edges")
    .select("*")
    .eq("uid", uid)

  if (expenseId) {
    q = q.eq("expense_id", expenseId)
  } else {
    q = q.order("weight", { ascending: false })
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data ?? []).map(rowToEdge))
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: {
    entityId: string
    expenseId: string
    edgeType: string
    amount: number
  }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const sb = getSupabase()

  // Verificar si el edge ya existe para este gasto + entidad
  const { data: existing } = await sb
    .from("entity_edges")
    .select("id")
    .eq("uid", uid)
    .eq("to_id", body.entityId)
    .eq("expense_id", body.expenseId)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  // Crear edge
  const { error: edgeError } = await sb
    .from("entity_edges")
    .insert({
      uid,
      from_id:    `expense:${body.expenseId}`,
      to_id:      body.entityId,
      type:       body.edgeType,
      expense_id: body.expenseId,
      weight:     body.amount,
    })

  if (edgeError) return NextResponse.json({ error: edgeError.message }, { status: 500 })

  // Actualizar stats de la entidad (totalSpend + occurrences)
  const { data: entity } = await sb
    .from("entities")
    .select("total_spend, occurrences")
    .eq("id", body.entityId)
    .eq("uid", uid)
    .single()

  if (entity) {
    const row = entity as Record<string, unknown>
    await sb
      .from("entities")
      .update({
        total_spend:  Number(row.total_spend ?? 0) + body.amount,
        occurrences:  Number(row.occurrences ?? 0) + 1,
      })
      .eq("id", body.entityId)
      .eq("uid", uid)
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
