/**
 * GET  /api/entities?type=...  — Lista entidades del usuario (filtro opcional por tipo)
 * POST /api/entities           — Crea una entidad nueva
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToEntity(row: Record<string, unknown>) {
  return {
    id:          row.id as string,
    type:        row.type as string,
    name:        row.name as string,
    emoji:       (row.emoji as string) ?? "",
    color:       (row.color as string) ?? "",
    metadata:    (row.metadata as Record<string, unknown>) ?? {},
    totalSpend:  Number(row.total_spend ?? 0),
    occurrences: Number(row.occurrences ?? 0),
    createdAt:   row.created_at as string,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { searchParams } = new URL(req.url)
  const filterType = searchParams.get("type")

  let q = getSupabase()
    .from("entities")
    .select("*")
    .eq("uid", uid)
    .order("occurrences", { ascending: false })

  if (filterType) {
    q = q.eq("type", filterType)
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data ?? []).map(rowToEntity))
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: {
    type: string
    name: string
    emoji?: string
    color?: string
    metadata?: Record<string, unknown>
  }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { data, error } = await getSupabase()
    .from("entities")
    .insert({
      uid,
      type:        body.type,
      name:        body.name,
      emoji:       body.emoji ?? null,
      color:       body.color ?? null,
      metadata:    body.metadata ?? {},
      total_spend: 0,
      occurrences: 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(rowToEntity(data as Record<string, unknown>), { status: 201 })
}
