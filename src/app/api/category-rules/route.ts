/**
 * GET  /api/category-rules  — Lista reglas de categorización del usuario
 * POST /api/category-rules  — Crea una nueva regla
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToRule(row: Record<string, unknown>) {
  return {
    id:         row.id,
    name:       row.name ?? "",
    field:      row.field,
    operator:   row.operator,
    value:      row.value,
    categoryId: row.category_id,
    order:      Number(row.sort_order ?? 0),
    enabled:    row.enabled ?? true,
    createdAt:  row.created_at,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data: rows, error } = await getSupabase()
    .from("category_rules")
    .select("*")
    .eq("uid", uid)
    .order("sort_order", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((rows ?? []).map(rowToRule))
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { data, error } = await getSupabase()
    .from("category_rules")
    .insert({
      uid,
      name:        body.name ?? null,
      field:       body.field,
      operator:    body.operator,
      value:       body.value,
      category_id: body.categoryId,
      sort_order:  body.order ?? 0,
      enabled:     body.enabled ?? true,
      created_at:  new Date().toISOString(),
    })
    .select("id").single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data?.id }, { status: 201 })
}
