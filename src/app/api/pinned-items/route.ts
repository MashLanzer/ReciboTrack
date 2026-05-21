/**
 * GET   /api/pinned-items  — Obtiene ítems fijados del usuario
 * PATCH /api/pinned-items  — Actualiza la lista de ítems fijados
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data, error } = await getSupabase()
    .from("pinned_items")
    .select("items")
    .eq("uid", uid)
    .single()

  if (error?.code === "PGRST116") return NextResponse.json([])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data?.items ?? [])
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: { items: unknown[] }
  try { body = (await req.json()) as { items: unknown[] } }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { error } = await getSupabase()
    .from("pinned_items")
    .upsert({ uid, items: body.items ?? [] }, { onConflict: "uid" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
