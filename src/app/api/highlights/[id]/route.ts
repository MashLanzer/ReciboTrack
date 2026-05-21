/**
 * PATCH /api/highlights/[id]  — Actualiza el campo pinned de un highlight
 * [id] es el `key` del highlight (= type)
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
  const { id: key } = await params

  let body: { pinned?: boolean }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  // Leer metadata actual para hacer merge
  const { data, error: readError } = await getSupabase()
    .from("highlights")
    .select("metadata")
    .eq("uid", uid)
    .eq("key", key)
    .single()

  if (readError?.code === "PGRST116") {
    return NextResponse.json({ error: "Highlight no encontrado" }, { status: 404 })
  }
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })

  const row = data as Record<string, unknown>
  const currentMeta = (row.metadata as Record<string, unknown>) ?? {}
  const newMeta = { ...currentMeta, ...("pinned" in body ? { pinned: body.pinned } : {}) }

  const { error } = await getSupabase()
    .from("highlights")
    .update({ metadata: newMeta, updated_at: new Date().toISOString() })
    .eq("uid", uid)
    .eq("key", key)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
