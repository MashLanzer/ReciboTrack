/**
 * PATCH  /api/travel-budgets/[id]  — Actualiza un presupuesto de viaje
 * DELETE /api/travel-budgets/[id]  — Elimina un presupuesto de viaje
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

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const toDateStr = (v: unknown): string => {
    if (typeof v === "string") return v.split("T")[0]
    return new Date().toISOString().split("T")[0]
  }

  const allowed: Record<string, string> = {
    name:       "name",
    emoji:      "emoji",
    totalLimit: "total_limit",
    currency:   "currency",
    tags:       "tags",
  }

  const patch: Record<string, unknown> = {}
  for (const [camel, snake] of Object.entries(allowed)) {
    if (camel in body) patch[snake] = body[camel]
  }
  if ("startDate" in body) patch.start_date = toDateStr(body.startDate)
  if ("endDate"   in body) patch.end_date   = toDateStr(body.endDate)

  const { error } = await getSupabase()
    .from("travel_budgets")
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
    .from("travel_budgets")
    .delete()
    .eq("id", id)
    .eq("uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
