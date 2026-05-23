/**
 * GET    /api/groups/[id]  — Detalle del grupo
 * PATCH  /api/groups/[id]  — Actualizar grupo (nombre, emoji, descripción, presupuesto, archivado)
 * DELETE /api/groups/[id]  — Eliminar grupo (solo el creador)
 *
 * NOTA: Los filtros de membresía usan JSONB @> igual que /api/groups,
 * porque los grupos se crean con `members JSONB` (no member_uids TEXT[]).
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type MemberRow = { uid: string; role?: string; email?: string; displayName?: string; joinedAt?: string }

function rowToGroup(row: Record<string, unknown>) {
  const members   = (row.members as MemberRow[]) ?? []
  const adminUid  = members.find((m) => m.role === "admin")?.uid ?? (row.created_by as string)
  const memberUids = members.map((m) => m.uid)
  return {
    id:          row.id as string,
    name:        row.name as string,
    emoji:       (row.emoji as string) ?? "👥",
    description: (row.description as string | undefined),
    budget:      row.budget != null ? Number(row.budget) : undefined,
    type:        (row.type as string | undefined),
    adminUid,
    memberUids,
    members,
    inviteCodes: row.invite_code ? [row.invite_code as string] : [],
    archived:    Boolean(row.archived ?? false),
    createdAt:   row.created_at as string,
  }
}

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
    .filter("members", "cs", JSON.stringify([{ uid }]))
    .single()

  if (error?.code === "PGRST116") return NextResponse.json(null, { status: 404 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(rowToGroup(data as Record<string, unknown>))
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

  // Solo columnas que realmente existen en el schema
  const allowed: Record<string, string> = {
    name:        "name",
    emoji:       "emoji",
    description: "description",
    budget:      "budget",
    type:        "type",
    archived:    "archived",
    archivedAt:  "archived_at",
    members:     "members",       // JSONB — actualiza todo el array de miembros
    inviteCode:  "invite_code",   // TEXT singular
  }

  const patch: Record<string, unknown> = {}
  for (const [camel, snake] of Object.entries(allowed)) {
    if (camel in body) patch[snake] = body[camel]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 })
  }

  // Seguridad: solo miembros pueden editar (JSONB @> filter)
  const { error } = await getSupabase()
    .from("groups")
    .update(patch)
    .eq("id", id)
    .filter("members", "cs", JSON.stringify([{ uid }]))

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

  // Solo el creador original puede eliminar el grupo
  const { error } = await getSupabase()
    .from("groups")
    .delete()
    .eq("id", id)
    .eq("created_by", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
