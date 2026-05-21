/**
 * GET  /api/groups/[id]/events  — Lista eventos del grupo
 * POST /api/groups/[id]/events  — Crea un evento
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

function rowToEvent(row: Record<string, unknown>) {
  return {
    id:          row.id as string,
    title:       (row.title ?? row.description) as string,
    date:        row.date as string,
    totalCost:   Number(row.total_cost ?? row.total_spend ?? 0),
    currency:    (row.currency as string) ?? "USD",
    splitMethod: (row.split_method as string) ?? "equal",
    attendees:   (row.attendees as string[]) ?? [],
    createdBy:   (row.created_by as string) ?? "",
    createdAt:   row.created_at as string,
    settled:     Boolean(row.settled ?? false),
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { id: groupId } = await params

  const { data, error } = await getSupabase()
    .from("group_events")
    .select("*")
    .eq("group_id", groupId)
    .order("date", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map((r) => rowToEvent(r as Record<string, unknown>)))
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id: groupId } = await params

  let body: { title: string; date: string; totalCost: number; currency: string; splitMethod: string }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { data, error } = await getSupabase()
    .from("group_events")
    .insert({
      group_id:     groupId,
      title:        body.title,
      description:  body.title,      // legacy field
      date:         body.date,
      total_cost:   body.totalCost,
      total_spend:  body.totalCost,  // legacy field
      currency:     body.currency,
      split_method: body.splitMethod,
      attendees:    [uid],
      created_by:   uid,
      rsvps:        {},
      settled:      false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(rowToEvent(data as Record<string, unknown>), { status: 201 })
}
