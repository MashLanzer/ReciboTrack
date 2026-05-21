/**
 * PATCH  /api/groups/[id]/folders/[folderId]  — Actualiza carpeta
 * DELETE /api/groups/[id]/folders/[folderId]  — Elimina carpeta
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string; folderId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { id: groupId, folderId } = await params

  let body: { name?: string; emoji?: string; description?: string }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) patch.name = body.name
  if (body.emoji !== undefined) patch.emoji = body.emoji
  if (body.description !== undefined) patch.description = body.description

  const { error } = await getSupabase()
    .from("group_folders")
    .update(patch)
    .eq("id", folderId)
    .eq("group_id", groupId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { id: groupId, folderId } = await params

  const { error } = await getSupabase()
    .from("group_folders")
    .delete()
    .eq("id", folderId)
    .eq("group_id", groupId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
