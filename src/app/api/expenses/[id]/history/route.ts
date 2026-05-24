import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params

  const { data, error } = await getSupabase()
    .from("expense_history")
    .select("id, field, old_value, new_value, changed_at")
    .eq("expense_id", id)
    .eq("uid", uid)
    .order("changed_at", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const history = (data ?? []).map((row) => ({
    id: row.id,
    field: row.field,
    oldValue: row.old_value,
    newValue: row.new_value,
    changedAt: row.changed_at,
  }))

  return NextResponse.json({ history })
}
