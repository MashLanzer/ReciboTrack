/**
 * DELETE /api/expenses/[id]/comments/[commentId] — Delete a comment by id
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string; commentId: string }> }

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { commentId } = await params

  const sb = getSupabase()

  // Verify the comment belongs to this user
  const { data: comment } = await sb
    .from("expense_comments")
    .select("id, uid")
    .eq("id", commentId)
    .single()

  if (!comment) {
    return NextResponse.json({ error: "Comentario no encontrado" }, { status: 404 })
  }

  if ((comment as { uid: string }).uid !== uid) {
    return NextResponse.json({ error: "No tienes permiso para eliminar este comentario" }, { status: 403 })
  }

  const { error } = await sb
    .from("expense_comments")
    .delete()
    .eq("id", commentId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
