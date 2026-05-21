/**
 * GET   /api/starred  — Obtiene categorías y comercios favoritos del usuario
 * PATCH /api/starred  — Actualiza la lista de favoritos
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

const EMPTY = { categories: [], merchants: [] }

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data, error } = await getSupabase()
    .from("starred")
    .select("categories, merchants")
    .eq("uid", uid)
    .single()

  if (error?.code === "PGRST116") return NextResponse.json(EMPTY)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    categories: data?.categories ?? [],
    merchants:  data?.merchants  ?? [],
  })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: { categories?: string[]; merchants?: string[] }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const sb = getSupabase()

  // Leer estado actual para hacer merge de arrays
  const { data: existing } = await sb.from("starred").select("categories, merchants").eq("uid", uid).single()

  const current = {
    categories: (existing?.categories ?? []) as string[],
    merchants:  (existing?.merchants  ?? []) as string[],
  }

  const next = {
    categories: body.categories ?? current.categories,
    merchants:  body.merchants  ?? current.merchants,
  }

  const { error } = await sb.from("starred").upsert({ uid, ...next }, { onConflict: "uid" })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
