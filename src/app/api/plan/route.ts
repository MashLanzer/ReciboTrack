import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getUserPlan, PLAN_LIMITS } from "@/lib/plan"
import { getSupabase } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const plan = await getUserPlan(uid)
  const limits = PLAN_LIMITS[plan]

  const supabase = getSupabase()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]

  const { count } = await supabase
    .from("expenses")
    .select("*", { count: "exact", head: true })
    .eq("uid", uid)
    .eq("archived", false)
    .gte("date", monthStart)
    .lte("date", monthEnd)

  const expensesThisMonth = count ?? 0
  const canAddExpenses = plan === "pro" || expensesThisMonth < limits.maxExpenses

  return NextResponse.json({
    plan,
    limits,
    expensesThisMonth,
    canAddExpenses,
  })
}
