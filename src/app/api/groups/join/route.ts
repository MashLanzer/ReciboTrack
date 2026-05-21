/**
 * POST /api/groups/join  — Unirse a un grupo por código de invitación
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: { inviteCode: string; email: string; displayName: string }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const code = body.inviteCode.toUpperCase().trim()

  // Buscar grupo con ese código de invitación
  const { data: groups } = await getSupabase()
    .from("groups")
    .select("*")
    .contains("invite_codes", [code])
    .limit(1)

  if (!groups || groups.length === 0) {
    return NextResponse.json({ error: "Código de invitación inválido o expirado" }, { status: 404 })
  }

  const group = groups[0] as Record<string, unknown>
  const memberUids = (group.member_uids as string[]) ?? []
  const members = (group.members as Record<string, unknown>[]) ?? []

  if (memberUids.includes(uid)) {
    return NextResponse.json({ error: "Ya eres miembro de este grupo" }, { status: 409 })
  }

  const newMember = {
    uid:         uid,
    email:       body.email,
    displayName: body.displayName,
    role:        "member",
    joinedAt:    new Date().toISOString(),
  }

  const { error } = await getSupabase()
    .from("groups")
    .update({
      member_uids: [...memberUids, uid],
      members:     [...members, newMember],
    })
    .eq("id", group.id as string)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ groupId: group.id as string, groupName: group.name as string })
}
