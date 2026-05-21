/**
 * POST /api/groups/[id]/bets/[betId]/join  — Unirse a una apuesta
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string; betId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id: groupId, betId } = await params

  const sb = getSupabase()

  // Leer participantes actuales
  const { data } = await sb
    .from("group_bets")
    .select("participants")
    .eq("id", betId)
    .eq("group_id", groupId)
    .single()

  const current = (data as Record<string, unknown> | null)?.participants as string[] ?? []
  const updated = [...new Set([...current, uid])]

  const { error } = await sb
    .from("group_bets")
    .update({ participants: updated, status: "active" })
    .eq("id", betId)
    .eq("group_id", groupId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
