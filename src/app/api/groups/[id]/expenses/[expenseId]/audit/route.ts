/**
 * GET /api/groups/[id]/expenses/[expenseId]/audit  — Audit log del gasto
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
    .from("group_expense_audit")
    .select("*")
    .eq("expense_id", expenseId)
    .order("timestamp", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    return {
      id:        row.id as string,
      expenseId: row.expense_id as string,
      groupId:   row.group_id as string,
      action:    row.action as string,
      byUid:     row.by_uid as string,
      byName:    row.by_name as string,
      summary:   row.summary as string,
      timestamp: row.timestamp as string,
    }
  }))
}
