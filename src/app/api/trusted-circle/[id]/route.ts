/**
 * PATCH  /api/trusted-circle/[id]  — Actualiza permisos de un miembro
 * DELETE /api/trusted-circle/[id]  — Elimina un miembro del círculo
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if ("canSeeFullBudget" in body) patch.can_see_full_budget = body.canSeeFullBudget
  if ("linked"           in body) patch.linked              = body.linked
  if ("displayName"      in body) patch.display_name        = body.displayName

  const { error } = await getSupabase()
    .from("trusted_circle")
    .update(patch)
    .eq("id", id)
    .eq("owner_uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params

  const { error } = await getSupabase()
    .from("trusted_circle")
    .delete()
    .eq("id", id)
    .eq("owner_uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
