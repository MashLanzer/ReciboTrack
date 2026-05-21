/**
 * GET  /api/groups/[id]/notes  — Lista notas válidas del grupo (filtrando expiradas)
 * POST /api/groups/[id]/notes  — Crea/actualiza la nota del usuario actual (una por usuario)
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

const NOTE_TTL_MS = 24 * 60 * 60 * 1000  // 24 horas

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { id: groupId } = await params

  const now = new Date().toISOString()

  // Leer notas no expiradas
  const { data, error } = await getSupabase()
    .from("group_notes")
    .select("*")
    .eq("group_id", groupId)
    .gt("expires_at", now)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    return {
      userId:    row.user_id as string,
      text:      row.text as string,
      createdAt: row.created_at as string,
      expiresAt: row.expires_at as string,
    }
  }))
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id: groupId } = await params

  let body: { text: string }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + NOTE_TTL_MS).toISOString()

  // Buscar si ya existe una nota del usuario en este grupo
  const { data: existing } = await getSupabase()
    .from("group_notes")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", uid)
    .limit(1)

  const sb = getSupabase()
  if (existing && existing.length > 0) {
    // Actualizar nota existente
    const row = existing[0] as { id: string }
    await sb
      .from("group_notes")
      .update({ text: body.text, created_at: now.toISOString(), expires_at: expiresAt })
      .eq("id", row.id)
  } else {
    // Crear nueva nota
    await sb
      .from("group_notes")
      .insert({
        group_id:   groupId,
        user_id:    uid,
        text:       body.text,
        expires_at: expiresAt,
      })
  }

  return NextResponse.json({ ok: true })
}
