/**
 * GET  /api/groups/[id]/settlements  — Lista liquidaciones
 * POST /api/groups/[id]/settlements  — Registra una liquidación
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

function rowToSettlement(row: Record<string, unknown>) {
  return {
    id:        row.id as string,
    groupId:   row.group_id as string,
    fromUid:   row.from_uid as string,
    toUid:     row.to_uid as string,
    amount:    Number(row.amount),
    currency:  (row.currency as string) ?? "USD",
    note:      (row.note as string) ?? "",
    date:      (row.settled_at as string),
    createdAt: (row.settled_at as string),
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { id: groupId } = await params

  const { data, error } = await getSupabase()
    .from("group_settlements")
    .select("*")
    .eq("group_id", groupId)
    .order("settled_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map((r) => rowToSettlement(r as Record<string, unknown>)))
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { id: groupId } = await params

  let body: { fromUid: string; toUid: string; amount: number; currency: string; note?: string }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { data, error } = await getSupabase()
    .from("group_settlements")
    .insert({
      group_id:   groupId,
      from_uid:   body.fromUid,
      to_uid:     body.toUid,
      amount:     body.amount,
      currency:   body.currency,
      settled_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(rowToSettlement(data as Record<string, unknown>), { status: 201 })
}
