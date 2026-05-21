/**
 * GET  /api/income  — Lista ingresos del usuario
 * POST /api/income  — Crea un ingreso
 *
 * Query params para GET:
 *   startDate — ISO date (>=)
 *   endDate   — ISO date (<=)
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToIncome(row: Record<string, unknown>) {
  return {
    id:          row.id,
    amount:      Number(row.amount),
    currency:    row.currency,
    source:      row.source ?? "",
    description: row.notes ?? null,    // notes → description en el cliente
    date:        row.date,             // DATE string "YYYY-MM-DD"
    recurring:   row.recurring ?? false,
    account:     row.account ?? undefined,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const sp = req.nextUrl.searchParams
  const startDate = sp.get("startDate")
  const endDate   = sp.get("endDate")

  let q = getSupabase()
    .from("income")
    .select("*")
    .eq("uid", uid)
    .order("date", { ascending: false })

  if (startDate) q = q.gte("date", startDate.split("T")[0])
  if (endDate)   q = q.lte("date", endDate.split("T")[0])

  const { data: rows, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((rows ?? []).map(rowToIncome))
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

  const toDateStr = (v: unknown): string => {
    if (typeof v === "string") return v.split("T")[0]
    if (v instanceof Date) return v.toISOString().split("T")[0]
    return new Date().toISOString().split("T")[0]
  }

  const { data, error } = await getSupabase()
    .from("income")
    .insert({
      uid,
      amount:    body.amount,
      currency:  body.currency ?? "USD",
      source:    body.source ?? null,
      notes:     body.description ?? null,   // description en cliente → notes en DB
      date:      toDateStr(body.date),
      recurring: body.recurring ?? false,
      account:   body.account ?? null,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data?.id }, { status: 201 })
}
