/**
 * PATCH  /api/income-categories/[id]  — Actualiza una categoría de ingresos
 * DELETE /api/income-categories/[id]  — Elimina una categoría de ingresos
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

  let body: Partial<{ name: string; emoji: string; color: string }>
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if ("name"  in body) patch.name  = body.name
  if ("emoji" in body) patch.emoji = body.emoji
  if ("color" in body) patch.color = body.color

  const { error } = await getSupabase()
    .from("income_categories")
    .update(patch)
    .eq("id", id)
    .eq("uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params

  const { error } = await getSupabase()
    .from("income_categories")
    .delete()
    .eq("id", id)
    .eq("uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
