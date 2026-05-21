/**
 * POST /api/groups/[id]/events/[eventId]/rsvp  — RSVP a un evento
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string; eventId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id: groupId, eventId } = await params

  let body: { attending: boolean }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const sb = getSupabase()

  // Leer attendees actuales
  const { data } = await sb
    .from("group_events")
    .select("attendees")
    .eq("id", eventId)
    .eq("group_id", groupId)
    .single()

  const current = (data as Record<string, unknown> | null)?.attendees as string[] ?? []
  const updated = body.attending
    ? [...new Set([...current, uid])]
    : current.filter((u) => u !== uid)

  const { error } = await sb
    .from("group_events")
    .update({ attendees: updated })
    .eq("id", eventId)
    .eq("group_id", groupId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
