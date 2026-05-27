/**
 * POST /api/workspaces/[id]/invite  — Crear enlace de invitación
 * GET  /api/workspaces/[id]/invite  — Listar invitaciones activas
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { id } = await params
  const sb = getSupabase()

  // Solo el propietario puede generar invitaciones
  const { data: workspace, error: wsError } = await sb
    .from("workspaces")
    .select("owner_uid")
    .eq("id", id)
    .single()

  if (wsError || !workspace) {
    return NextResponse.json({ error: "Espacio no encontrado" }, { status: 404 })
  }

  if (workspace.owner_uid !== uid) {
    return NextResponse.json({ error: "Solo el propietario puede generar invitaciones" }, { status: 403 })
  }

  const { data: invite, error: inviteError } = await sb
    .from("workspace_invites")
    .insert({ workspace_id: id, created_by: uid })
    .select("token")
    .single()

  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 })

  const baseUrl = req.nextUrl.origin
  const inviteUrl = `${baseUrl}/join/workspace/${invite.token}`

  return NextResponse.json({ token: invite.token, inviteUrl }, { status: 201 })
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { id } = await params
  const sb = getSupabase()

  // Verificar acceso
  const { data: workspace, error: wsError } = await sb
    .from("workspaces")
    .select("owner_uid")
    .eq("id", id)
    .single()

  if (wsError || !workspace) {
    return NextResponse.json({ error: "Espacio no encontrado" }, { status: 404 })
  }

  if (workspace.owner_uid !== uid) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
  }

  const now = new Date().toISOString()
  const { data: invites, error: invitesError } = await sb
    .from("workspace_invites")
    .select("id, token, expires_at, used_at, created_at")
    .eq("workspace_id", id)
    .is("used_at", null)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })

  if (invitesError) return NextResponse.json({ error: invitesError.message }, { status: 500 })

  return NextResponse.json({ invites: invites ?? [] })
}
