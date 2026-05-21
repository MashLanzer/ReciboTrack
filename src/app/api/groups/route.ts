/**
 * GET  /api/groups  — Lista grupos donde el usuario es miembro
 * POST /api/groups  — Crea un nuevo grupo
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToGroup(row: Record<string, unknown>) {
  return {
    id:          row.id as string,
    name:        row.name as string,
    emoji:       (row.emoji as string) ?? "👥",
    description: (row.description as string) ?? undefined,
    budget:      row.budget != null ? Number(row.budget) : undefined,
    type:        (row.type as string) ?? undefined,
    adminUid:    (row.admin_uid as string) ?? (row.created_by as string),
    memberUids:  (row.member_uids as string[]) ?? [],
    members:     (row.members as unknown[]) ?? [],
    inviteCodes: (row.invite_codes as string[]) ?? [],
    archived:    Boolean(row.archived ?? false),
    createdAt:   row.created_at as string,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data, error } = await getSupabase()
    .from("groups")
    .select("*")
    .contains("member_uids", [uid])
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(rowToGroup))
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: {
    name: string
    emoji: string
    description?: string
    type?: string
    member: { uid: string; email: string; displayName: string }
    inviteCode: string
  }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const member = {
    uid:         body.member.uid,
    email:       body.member.email,
    displayName: body.member.displayName,
    role:        "admin",
    joinedAt:    new Date().toISOString(),
  }

  const { data, error } = await getSupabase()
    .from("groups")
    .insert({
      name:         body.name,
      emoji:        body.emoji,
      description:  body.description ?? null,
      type:         body.type ?? null,
      created_by:   uid,
      admin_uid:    uid,
      member_uids:  [uid],
      members:      [member],
      invite_code:  body.inviteCode,
      invite_codes: [body.inviteCode],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(rowToGroup(data as Record<string, unknown>), { status: 201 })
}
