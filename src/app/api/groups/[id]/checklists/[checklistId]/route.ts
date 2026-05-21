/**
 * PATCH  /api/groups/[id]/checklists/[checklistId]  — Actualiza checklist (items)
 * DELETE /api/groups/[id]/checklists/[checklistId]  — Elimina checklist
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string; checklistId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { id: groupId, checklistId } = await params

  let body: { items?: unknown[]; title?: string }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (body.items !== undefined) patch.items = body.items
  if (body.title !== undefined) patch.name = body.title

  const { error } = await getSupabase()
    .from("group_checklists")
    .update(patch)
    .eq("id", checklistId)
    .eq("group_id", groupId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { id: groupId, checklistId } = await params

  const { error } = await getSupabase()
    .from("group_checklists")
    .delete()
    .eq("id", checklistId)
    .eq("group_id", groupId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
