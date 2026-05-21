/**
 * PATCH /api/groups/[id]/bets/[betId]  — Actualiza apuesta (unirse, resolver)
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string; betId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { id: groupId, betId } = await params

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const allowed: Record<string, string> = {
    participants: "participants",
    status:       "status",
    resultData:   "result_data",
    resolvedAt:   "resolved_at",
  }

  const patch: Record<string, unknown> = {}
  for (const [camel, snake] of Object.entries(allowed)) {
    if (camel in body) patch[snake] = body[camel]
  }

  const { error } = await getSupabase()
    .from("group_bets")
    .update(patch)
    .eq("id", betId)
    .eq("group_id", groupId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
