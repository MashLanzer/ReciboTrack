/**
 * GET  /api/groups/[id]/checklists  — Lista checklists del grupo
 * POST /api/groups/[id]/checklists  — Crea un checklist
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

function rowToChecklist(row: Record<string, unknown>) {
  return {
    id:           row.id as string,
    groupId:      row.group_id as string,
    title:        (row.name ?? row.title) as string,
    items:        (row.items as unknown[]) ?? [],
    createdByUid: (row.created_by_uid ?? row.created_by) as string,
    createdAt:    row.created_at as string,
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { id: groupId } = await params

  const { data, error } = await getSupabase()
    .from("group_checklists")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map((r) => rowToChecklist(r as Record<string, unknown>)))
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id: groupId } = await params

  let body: { title: string; items: Array<{ id: string; text: string; done: boolean }> }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { data, error } = await getSupabase()
    .from("group_checklists")
    .insert({
      group_id:        groupId,
      name:            body.title,
      items:           body.items,
      created_by:      uid,
      created_by_uid:  uid,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(rowToChecklist(data as Record<string, unknown>), { status: 201 })
}
