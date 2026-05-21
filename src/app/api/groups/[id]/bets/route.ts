/**
 * GET  /api/groups/[id]/bets  — Lista apuestas del grupo
 * POST /api/groups/[id]/bets  — Crea una apuesta
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

function rowToBet(row: Record<string, unknown>) {
  return {
    id:           row.id as string,
    title:        row.title as string,
    creatorId:    (row.creator_id as string) ?? (row.created_by as string),
    creatorName:  (row.creator_name as string) ?? "",
    category:     (row.category as string) ?? undefined,
    targetAmount: Number(row.target_amount ?? 0),
    currency:     (row.currency as string) ?? "USD",
    period:       (row.period as string) ?? "month",
    stake:        (row.stake as string) ?? "",
    participants: (row.participants as string[]) ?? [],
    status:       (row.status as string) ?? "open",
    result:       (row.result_data as Record<string, unknown>) ?? undefined,
    createdAt:    row.created_at as string,
    endsAt:       (row.ends_at as string) ?? "",
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { id: groupId } = await params

  const { data, error } = await getSupabase()
    .from("group_bets")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map((r) => rowToBet(r as Record<string, unknown>)))
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id: groupId } = await params

  let body: {
    title: string; category?: string; targetAmount: number; currency: string
    period: "week" | "month"; stake: string
    creatorName: string; endsAt: string
  }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { data, error } = await getSupabase()
    .from("group_bets")
    .insert({
      group_id:      groupId,
      title:         body.title,
      creator_id:    uid,
      creator_name:  body.creatorName,
      category:      body.category ?? null,
      target_amount: body.targetAmount,
      currency:      body.currency,
      period:        body.period,
      stake:         body.stake,
      participants:  [uid],
      status:        "open",
      ends_at:       body.endsAt,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(rowToBet(data as Record<string, unknown>), { status: 201 })
}
