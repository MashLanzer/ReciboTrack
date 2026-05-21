/**
 * DELETE /api/category-budgets/[id]  — Elimina un presupuesto por categoría (budget_key como id)
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params  // id = budget_key

  const { error } = await getSupabase()
    .from("category_budgets")
    .delete()
    .eq("uid", uid)
    .eq("budget_key", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
