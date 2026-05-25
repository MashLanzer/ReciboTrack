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
    notes:     row.notes ?? "",
    tags:      row.tags ?? [],
    icon:      row.icon ?? "📌",
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
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 })
  }

  const { data, error } = await getSupabase()
    .from("expense_templates")
    .insert({
      uid,
      name:     (body.name as string).trim(),
      merchant: (body.merchant as string | undefined) ?? "",
      category: (body.category as string | undefined) ?? "Otros",
      amount:   body.amount ?? 0,
      currency: (body.currency as string | undefined) ?? "USD",
      account:  (body.account as string | undefined) ?? "personal",
      notes:    (body.notes as string | undefined) ?? "",
      tags:     body.tags ?? [],
      icon:     (body.icon as string | undefined) ?? "📌",
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data?.id }, { status: 201 })
}
