/**
 * POST /api/groups/join  — Unirse a un grupo por código de invitación
 *
 * Busca por invite_code (TEXT singular, no el array legacy invite_codes).
 * Actualiza solo el array JSONB `members` — no usa member_uids.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type MemberRow = { uid: string; role?: string; email?: string; displayName?: string; joinedAt?: string }

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid, email, displayName } = auth

  let body: { inviteCode: string; email?: string; displayName?: string }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const code = (body.inviteCode ?? "").toUpperCase().trim()
  if (!code) return NextResponse.json({ error: "Código requerido" }, { status: 400 })

  // Buscar por invite_code (TEXT singular) — el campo que realmente existe
  const { data: group, error: findError } = await getSupabase()
    .from("groups")
    .select("*")
    .eq("invite_code", code)
    .single()

  if (findError || !group) {
    return NextResponse.json({ error: "Código de invitación inválido o expirado" }, { status: 404 })
  }

  const g = group as Record<string, unknown>
  const members = (g.members as MemberRow[]) ?? []

  // Verificar si ya es miembro usando el array JSONB
  if (members.some((m) => m.uid === uid)) {
    return NextResponse.json({ error: "Ya eres miembro de este grupo" }, { status: 409 })
  }

  const newMember: MemberRow = {
    uid,
    email:       body.email ?? email ?? "",
    displayName: body.displayName ?? displayName ?? "",
    role:        "member",
    joinedAt:    new Date().toISOString(),
  }

  const { error } = await getSupabase()
    .from("groups")
    .update({ members: [...members, newMember] })
    .eq("id", g.id as string)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ groupId: g.id as string, groupName: g.name as string })
}
