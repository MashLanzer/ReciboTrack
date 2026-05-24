/**
 * PATCH  /api/recurring-income/[id]  — Update template
 * DELETE /api/recurring-income/[id]  — Delete template
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params
  const body = await req.json() as Record<string, unknown>
  const updates: Record<string, unknown> = {}
  if (body.description  !== undefined) updates.description   = body.description
  if (body.source       !== undefined) updates.source        = body.source
  if (body.amount       !== undefined) updates.amount        = body.amount
  if (body.currency     !== undefined) updates.currency      = body.currency
  if (body.frequency    !== undefined) updates.frequency     = body.frequency
  if (body.nextDueDate  !== undefined) updates.next_due_date = body.nextDueDate
  if (body.account      !== undefined) updates.account       = body.account
  if (body.isActive     !== undefined) updates.is_active     = body.isActive
  const { error } = await getSupabase().from("recurring_income").update(updates).eq("id", id).eq("uid", uid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params
  const { error } = await getSupabase().from("recurring_income").delete().eq("id", id).eq("uid", uid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
