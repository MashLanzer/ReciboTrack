/**
 * GET   /api/watchlist  — Obtiene la lista de vigilancia de categorías del usuario
 * PATCH /api/watchlist  — Actualiza la lista (reemplaza completamente)
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data, error } = await getSupabase()
    .from("watchlist")
    .select("categories")
    .eq("uid", uid)
    .single()

  if (error?.code === "PGRST116") return NextResponse.json([])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data?.categories ?? [])
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: { entries: unknown[] }
  try { body = (await req.json()) as { entries: unknown[] } }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { error } = await getSupabase()
    .from("watchlist")
    .upsert({ uid, categories: body.entries ?? [] }, { onConflict: "uid" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
