/**
 * GET  /api/recurring-income  — List user's recurring income templates
 * POST /api/recurring-income  — Create a new template
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToTemplate(row: Record<string, unknown>) {
  return {
    id:           row.id,
    description:  row.description,
    source:       row.source,
    amount:       Number(row.amount),
    currency:     row.currency,
    frequency:    row.frequency,
    nextDueDate:  row.next_due_date,
    account:      row.account,
    isActive:     row.is_active,
    createdAt:    row.created_at,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { data, error } = await getSupabase()
    .from("recurring_income")
    .select("*")
    .eq("uid", uid)
    .order("next_due_date", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(rowToTemplate))
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const body = await req.json() as Record<string, unknown>
  const { data, error } = await getSupabase()
    .from("recurring_income")
    .insert({
      uid,
      description:   body.description,
      source:        body.source ?? "Otro",
      amount:        body.amount,
      currency:      body.currency ?? "USD",
      frequency:     body.frequency ?? "monthly",
      next_due_date: body.nextDueDate,
      account:       body.account ?? "personal",
      is_active:     body.isActive ?? true,
    })
    .select("id").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
