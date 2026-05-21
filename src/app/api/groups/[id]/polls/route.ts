/**
 * GET  /api/groups/[id]/polls  — Lista encuestas del grupo
 * POST /api/groups/[id]/polls  — Crea una encuesta
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

function rowToPoll(row: Record<string, unknown>) {
  return {
    id:          row.id as string,
    question:    (row.question ?? row.title) as string,
    options:     (row.options as unknown[]) ?? [],
    status:      (row.status as string) ?? "open",
    result:      (row.result as string) ?? undefined,
    splitMethod: (row.split_method as string) ?? undefined,
    createdBy:   row.created_by as string,
    createdAt:   row.created_at as string,
    closesAt:    (row.closes_at as string) ?? undefined,
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { id: groupId } = await params

  const { data, error } = await getSupabase()
    .from("group_polls")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map((r) => rowToPoll(r as Record<string, unknown>)))
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id: groupId } = await params

  let body: { question: string; options: Array<{ id: string; label: string; votes: string[] }>; closesAt?: string }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { data, error } = await getSupabase()
    .from("group_polls")
    .insert({
      group_id:   groupId,
      title:      body.question,
      question:   body.question,
      options:    body.options,
      status:     "open",
      created_by: uid,
      closes_at:  body.closesAt ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(rowToPoll(data as Record<string, unknown>), { status: 201 })
}
