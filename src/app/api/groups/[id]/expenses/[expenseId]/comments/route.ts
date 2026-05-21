/**
 * GET  /api/groups/[id]/expenses/[expenseId]/comments  — Lista comentarios
 * POST /api/groups/[id]/expenses/[expenseId]/comments  — Agrega comentario
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string; expenseId: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { expenseId } = await params

  const { data, error } = await getSupabase()
    .from("group_comments")
    .select("*")
    .eq("expense_id", expenseId)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    return {
      id:          row.id as string,
      uid:         row.user_id as string,
      displayName: (row.display_name as string) ?? "",
      photoURL:    (row.photo_url as string) ?? null,
      text:        row.text as string,
      createdAt:   row.created_at as string,
    }
  }))
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id: groupId, expenseId } = await params

  let body: { text: string; displayName?: string; photoURL?: string | null }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { data, error } = await getSupabase()
    .from("group_comments")
    .insert({
      group_id:     groupId,
      expense_id:   expenseId,
      user_id:      uid,
      display_name: body.displayName ?? "",
      photo_url:    body.photoURL ?? null,
      text:         body.text.trim(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const row = data as Record<string, unknown>
  return NextResponse.json({
    id:          row.id as string,
    uid:         row.user_id as string,
    displayName: (row.display_name as string) ?? "",
    photoURL:    (row.photo_url as string) ?? null,
    text:        row.text as string,
    createdAt:   row.created_at as string,
  }, { status: 201 })
}
