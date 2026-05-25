/**
 * POST /api/workspaces/join/[token]  — Unirse a un espacio con un token de invitación
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ token: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { token } = await params
  const sb = getSupabase()
  const now = new Date().toISOString()

  // Buscar el token de invitación
  const { data: invite, error: inviteError } = await sb
    .from("workspace_invites")
    .select("id, workspace_id, expires_at, used_at")
    .eq("token", token)
    .single()

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invitación no encontrada o inválida" }, { status: 404 })
  }

  if (invite.used_at) {
    return NextResponse.json({ error: "Esta invitación ya fue utilizada" }, { status: 400 })
  }

  if (invite.expires_at < now) {
    return NextResponse.json({ error: "Esta invitación ha expirado" }, { status: 400 })
  }

  // Verificar si el usuario ya es miembro
  const { data: existingMember } = await sb
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", invite.workspace_id)
    .eq("uid", uid)
    .single()

  if (existingMember) {
    return NextResponse.json({
      error: "Ya eres miembro de este espacio",
      workspaceId: invite.workspace_id,
    }, { status: 400 })
  }

  // Obtener datos del espacio para devolver en la respuesta
  const { data: workspace } = await sb
    .from("workspaces")
    .select("id, name")
    .eq("id", invite.workspace_id)
    .single()

  // Añadir al usuario como miembro
  const { error: memberError } = await sb
    .from("workspace_members")
    .insert({ workspace_id: invite.workspace_id, uid, role: "member" })

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  // Marcar el token como usado
  await sb
    .from("workspace_invites")
    .update({ used_at: now })
    .eq("id", invite.id)

  return NextResponse.json({
    success: true,
    workspaceId: invite.workspace_id,
    workspaceName: workspace?.name ?? "",
  })
}

// GET para previsualizar la invitación (nombre del espacio) sin autenticación
export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params
  const sb = getSupabase()
  const now = new Date().toISOString()

  const { data: invite, error } = await sb
    .from("workspace_invites")
    .select("workspace_id, expires_at, used_at, workspaces(name)")
    .eq("token", token)
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 })
  }

  if (invite.used_at) {
    return NextResponse.json({ error: "Esta invitación ya fue utilizada", valid: false })
  }

  if (invite.expires_at < now) {
    return NextResponse.json({ error: "Esta invitación ha expirado", valid: false })
  }

  const workspace = invite.workspaces as { name: string } | null

  return NextResponse.json({
    valid: true,
    workspaceName: workspace?.name ?? "",
    workspaceId: invite.workspace_id,
  })
}
