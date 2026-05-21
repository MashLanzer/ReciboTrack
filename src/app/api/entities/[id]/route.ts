/**
 * PATCH  /api/entities/[id]  — Actualiza una entidad (totalSpend, occurrences, etc.)
 * DELETE /api/entities/[id]  — Elimina una entidad
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const allowed: Record<string, string> = {
    name:        "name",
    emoji:       "emoji",
    color:       "color",
    metadata:    "metadata",
    totalSpend:  "total_spend",
    occurrences: "occurrences",
  }

  const patch: Record<string, unknown> = {}
  for (const [camel, snake] of Object.entries(allowed)) {
    if (camel in body) patch[snake] = body[camel]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 })
  }

  const { error } = await getSupabase()
    .from("entities")
    .update(patch)
    .eq("id", id)
    .eq("uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params

  const { error } = await getSupabase()
    .from("entities")
    .delete()
    .eq("id", id)
    .eq("uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
