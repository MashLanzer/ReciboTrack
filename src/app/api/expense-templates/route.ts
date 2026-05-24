import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToTemplate(row: Record<string, unknown>) {
  return {
    id:        row.id,
    name:      row.name,
    merchant:  row.merchant,
    category:  row.category,
    amount:    Number(row.amount),
    currency:  row.currency,
    account:   row.account,
    notes:     row.notes,
    tags:      row.tags ?? [],
    icon:      row.icon,
    createdAt: row.created_at,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data: rows, error } = await getSupabase()
    .from("expense_templates")
    .select("*")
    .eq("uid", uid)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((rows ?? []).map(rowToTemplate))
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { data, error } = await getSupabase()
    .from("expense_templates")
    .insert({
      uid,
      name:     body.name,
      merchant: body.merchant ?? "",
      category: body.category ?? "Otros",
      amount:   body.amount ?? 0,
      currency: body.currency ?? "USD",
      account:  body.account ?? "personal",
      notes:    body.notes ?? "",
      tags:     body.tags ?? [],
      icon:     body.icon ?? "📌",
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data?.id }, { status: 201 })
}
