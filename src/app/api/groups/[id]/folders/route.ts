/**
 * GET  /api/groups/[id]/folders  — Lista carpetas del grupo
 * POST /api/groups/[id]/folders  — Crea una carpeta
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

function rowToFolder(row: Record<string, unknown>) {
  return {
    id:           row.id as string,
    groupId:      row.group_id as string,
    name:         row.name as string,
    emoji:        (row.emoji as string) ?? "📁",
    description:  (row.description as string) ?? undefined,
    createdByUid: (row.created_by_uid ?? row.created_by) as string,
    createdAt:    row.created_at as string,
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { id: groupId } = await params

  const { data, error } = await getSupabase()
    .from("group_folders")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map((r) => rowToFolder(r as Record<string, unknown>)))
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id: groupId } = await params

  let body: { name: string; emoji: string; description?: string }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { data, error } = await getSupabase()
    .from("group_folders")
    .insert({
      group_id:        groupId,
      name:            body.name,
      emoji:           body.emoji,
      description:     body.description ?? null,
      created_by_uid:  uid,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(rowToFolder(data as Record<string, unknown>), { status: 201 })
}
