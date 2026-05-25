/**
 * GET    /api/workspaces/[id]  — Detalles del espacio + miembros
 * DELETE /api/workspaces/[id]  — Eliminar espacio (solo propietario)
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { id } = await params
  const sb = getSupabase()

  // Verificar que el usuario es propietario o miembro
  const { data: membership, error: memberCheckError } = await sb
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", id)
    .eq("uid", uid)
    .single()

  if (memberCheckError || !membership) {
    return NextResponse.json({ error: "No tienes acceso a este espacio" }, { status: 403 })
  }

  const { data: workspace, error: wsError } = await sb
    .from("workspaces")
    .select("*")
    .eq("id", id)
    .single()

  if (wsError || !workspace) {
    return NextResponse.json({ error: "Espacio no encontrado" }, { status: 404 })
  }

  const { data: members, error: membersError } = await sb
    .from("workspace_members")
    .select("id, uid, role, joined_at")
    .eq("workspace_id", id)
    .order("joined_at", { ascending: true })

  if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 })

  return NextResponse.json({ workspace, members: members ?? [], userRole: membership.role })
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { id } = await params
  const sb = getSupabase()

  // Verificar que el usuario es el propietario
  const { data: workspace, error: wsError } = await sb
    .from("workspaces")
    .select("owner_uid")
    .eq("id", id)
    .single()

  if (wsError || !workspace) {
    return NextResponse.json({ error: "Espacio no encontrado" }, { status: 404 })
  }

  if (workspace.owner_uid !== uid) {
    return NextResponse.json({ error: "Solo el propietario puede eliminar el espacio" }, { status: 403 })
  }

  const { error: deleteError } = await sb.from("workspaces").delete().eq("id", id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
