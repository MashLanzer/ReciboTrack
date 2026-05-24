/**
 * GET  /api/groups  — Lista grupos donde el usuario es miembro
 * POST /api/groups  — Crea un nuevo grupo
 *
 * Schema real de la tabla `groups`:
 *   id, name, emoji, currency, invite_code (TEXT), members (JSONB[]),
 *   created_by, created_at
 *
 * adminUid y memberUids se derivan del array JSONB `members`.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type MemberRow = { uid: string; role?: string; email?: string; displayName?: string; joinedAt?: string }

function rowToGroup(row: Record<string, unknown>) {
  const members  = (row.members as MemberRow[]) ?? []
  const adminUid = members.find((m) => m.role === "admin")?.uid ?? (row.created_by as string)
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
    // invite_code es singular en el schema — lo exponemos como array por compatibilidad
    inviteCodes: row.invite_code ? [row.invite_code as string] : [],
    archived:    Boolean(row.archived ?? false),
    createdAt:   row.created_at as string,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  // Supabase JSONB @> filter: busca grupos donde members contiene {uid}
  const { data, error } = await getSupabase()
    .from("groups")
    .select("*")
    .filter("members", "cs", JSON.stringify([{ uid }]))
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map((r) => rowToGroup(r as Record<string, unknown>)))
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

  const member: MemberRow = {
    uid:         body.member.uid,
    email:       body.member.email,
    displayName: body.member.displayName,
    role:        "admin",
    joinedAt:    new Date().toISOString(),
  }

  const insertRow: Record<string, unknown> = {
    name:        body.name,
    emoji:       body.emoji,
    currency:    "USD",
    created_by:  uid,
    members:     [member],
    invite_code: body.inviteCode,
  }
  // Solo añadir columnas opcionales si las pasaron (evita errores si la col no existe)
  if (body.description) insertRow.description = body.description
  if (body.type)        insertRow.type        = body.type

  const { data, error } = await getSupabase()
    .from("groups")
    .insert(insertRow)
    .select()
    .single()

  if (error) {
    console.error("[POST /api/groups] Supabase error:", error.message, error.details, error.hint)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(rowToGroup(data as Record<string, unknown>), { status: 201 })
}
