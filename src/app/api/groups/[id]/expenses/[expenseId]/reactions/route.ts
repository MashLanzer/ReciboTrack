/**
 * GET  /api/groups/[id]/expenses/[expenseId]/reactions  — Lista reacciones
 * POST /api/groups/[id]/expenses/[expenseId]/reactions  — Toggle reacción
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
    .from("group_reactions")
    .select("emoji, user_id")
    .eq("expense_id", expenseId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Agrupar por emoji
  const grouped: Record<string, string[]> = {}
  for (const row of (data ?? []) as Array<{ emoji: string; user_id: string }>) {
    if (!grouped[row.emoji]) grouped[row.emoji] = []
    grouped[row.emoji].push(row.user_id)
  }

  return NextResponse.json(grouped)
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id: groupId, expenseId } = await params

  let body: { emoji: string }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const sb = getSupabase()

  // Buscar reacción existente del usuario en este gasto
  const { data: existing } = await sb
    .from("group_reactions")
    .select("id, emoji")
    .eq("expense_id", expenseId)
    .eq("user_id", uid)
    .limit(1)

  const existingRow = existing?.[0] as { id: string; emoji: string } | undefined

  if (existingRow && existingRow.emoji === body.emoji) {
    // Misma emoji → toggle off (borrar)
    await sb.from("group_reactions").delete().eq("id", existingRow.id)
  } else {
    if (existingRow) {
      // Emoji diferente → actualizar
      await sb.from("group_reactions").update({ emoji: body.emoji }).eq("id", existingRow.id)
    } else {
      // Nueva reacción
      await sb.from("group_reactions").insert({
        group_id:   groupId,
        expense_id: expenseId,
        user_id:    uid,
        emoji:      body.emoji,
      })
    }
  }

  return NextResponse.json({ ok: true })
}
