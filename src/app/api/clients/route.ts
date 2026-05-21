/**
 * GET  /api/clients  — Lista clientes del usuario
 * POST /api/clients  — Crea un cliente
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToClient(row: Record<string, unknown>) {
  return {
    id:        row.id,
    name:      row.name,
    email:     row.email ?? undefined,
    phone:     row.phone ?? undefined,
    notes:     row.notes ?? undefined,
    color:     row.color ?? "#6b7280",
    isActive:  row.is_active ?? true,
    createdAt: row.created_at,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data: rows, error } = await getSupabase()
    .from("clients")
    .select("*")
    .eq("uid", uid)
    .order("name", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((rows ?? []).map(rowToClient))
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { data, error } = await getSupabase()
    .from("clients")
    .insert({
      uid,
      name:       body.name,
      email:      body.email ?? null,
      phone:      body.phone ?? null,
      notes:      body.notes ?? null,
      color:      body.color ?? "#6b7280",
      is_active:  body.isActive ?? true,
      created_at: new Date().toISOString(),
    })
    .select("id").single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data?.id }, { status: 201 })
}
