/**
 * DELETE /api/groups/[id]/expenses/[expenseId]/comments/[commentId]
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string; expenseId: string; commentId: string }> }

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { commentId } = await params

  const { error } = await getSupabase()
    .from("group_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
