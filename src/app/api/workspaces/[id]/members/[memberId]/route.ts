/**
 * DELETE /api/workspaces/[id]/members/[memberId]  — Expulsar un miembro (solo propietario)
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string; memberId: string }> }

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { id, memberId } = await params
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
    return NextResponse.json({ error: "Solo el propietario puede expulsar miembros" }, { status: 403 })
  }

  // Obtener el miembro a eliminar
  const { data: member, error: memberError } = await sb
    .from("workspace_members")
    .select("uid, role")
    .eq("id", memberId)
    .eq("workspace_id", id)
    .single()

  if (memberError || !member) {
    return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 })
  }

  // No se puede expulsar al propietario
  if (member.role === "owner") {
    return NextResponse.json({ error: "No se puede expulsar al propietario" }, { status: 400 })
  }

  const { error: deleteError } = await sb
    .from("workspace_members")
    .delete()
    .eq("id", memberId)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
