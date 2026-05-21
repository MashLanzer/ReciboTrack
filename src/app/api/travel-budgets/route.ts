/**
 * GET  /api/travel-budgets  — Lista presupuestos de viaje del usuario
 * POST /api/travel-budgets  — Crea un presupuesto de viaje
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToTravelBudget(row: Record<string, unknown>) {
  return {
    id:         row.id,
    name:       row.name,
    emoji:      row.emoji ?? null,
    totalLimit: Number(row.total_limit),
    currency:   row.currency,
    startDate:  row.start_date,   // DATE string "YYYY-MM-DD"
    endDate:    row.end_date,     // DATE string "YYYY-MM-DD"
    tags:       row.tags ?? [],
    createdAt:  row.created_at,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data: rows, error } = await getSupabase()
    .from("travel_budgets")
    .select("*")
    .eq("uid", uid)
    .order("start_date", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((rows ?? []).map(rowToTravelBudget))
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  // Normalizar fechas: puede llegar como ISO string o como "YYYY-MM-DD"
  const toDateStr = (v: unknown): string => {
    if (typeof v === "string") return v.split("T")[0]
    return new Date().toISOString().split("T")[0]
  }

  const { data, error } = await getSupabase()
    .from("travel_budgets")
    .insert({
      uid,
      name:        body.name,
      emoji:       body.emoji ?? null,
      total_limit: body.totalLimit,
      currency:    body.currency ?? "USD",
      start_date:  toDateStr(body.startDate),
      end_date:    toDateStr(body.endDate),
      tags:        body.tags ?? [],
      created_at:  new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data?.id }, { status: 201 })
}
