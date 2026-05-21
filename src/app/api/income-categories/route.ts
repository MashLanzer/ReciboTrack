/**
 * GET  /api/income-categories  — Lista categorías de ingresos del usuario
 * POST /api/income-categories  — Crea una nueva categoría de ingresos
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data, error } = await getSupabase()
    .from("income_categories")
    .select("*")
    .eq("uid", uid)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map((r: Record<string, unknown>) => ({
    id:        r.id,
    name:      r.name,
    emoji:     r.emoji ?? "",
    color:     r.color ?? "",
    createdAt: r.created_at,
  }))

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: { name: string; emoji?: string; color?: string }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { data, error } = await getSupabase()
    .from("income_categories")
    .insert({
      uid,
      name:       body.name,
      emoji:      body.emoji ?? "",
      color:      body.color ?? "",
      created_at: new Date().toISOString(),
    })
    .select("id, name, emoji, color, created_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const row = data as Record<string, unknown>
  return NextResponse.json({
    id:        row.id,
    name:      row.name,
    emoji:     row.emoji ?? "",
    color:     row.color ?? "",
    createdAt: row.created_at,
  }, { status: 201 })
}
