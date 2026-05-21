/**
 * GET    /api/groups/[id]  — Detalle del grupo
 * PATCH  /api/groups/[id]  — Actualizar grupo (nombre, emoji, descripción, presupuesto, archivado)
 * DELETE /api/groups/[id]  — Eliminar grupo (solo admin)
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params

  const { data, error } = await getSupabase()
    .from("groups")
    .select("*")
    .eq("id", id)
    .contains("member_uids", [uid])
    .single()

  if (error?.code === "PGRST116") return NextResponse.json(null, { status: 404 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const allowed: Record<string, string> = {
    name:        "name",
    emoji:       "emoji",
    description: "description",
    budget:      "budget",
    type:        "type",
    archived:    "archived",
    archivedAt:  "archived_at",
    members:     "members",
    memberUids:  "member_uids",
    inviteCodes: "invite_codes",
    inviteCode:  "invite_code",
  }

  const patch: Record<string, unknown> = {}
  for (const [camel, snake] of Object.entries(allowed)) {
    if (camel in body) patch[snake] = body[camel]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 })
  }

  const { error } = await getSupabase()
    .from("groups")
    .update(patch)
    .eq("id", id)
    .contains("member_uids", [uid])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params

  const { error } = await getSupabase()
    .from("groups")
    .delete()
    .eq("id", id)
    .eq("admin_uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
