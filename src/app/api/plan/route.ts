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

  // Gastos del mes actual (sin contar archivados)
  const { count: expensesCount } = await supabase
    .from("expenses")
    .select("*", { count: "exact", head: true })
    .eq("uid", uid)
    .eq("archived", false)
    .gte("date", monthStart)
    .lte("date", monthEnd)
  const expensesThisMonth = expensesCount ?? 0

  // Workspaces creados por el usuario (lo que usa el límite)
  const { count: wsCount } = await supabase
    .from("workspaces")
    .select("*", { count: "exact", head: true })
    .eq("owner_uid", uid)
  const workspacesCount = wsCount ?? 0

  const canAddExpenses   = expensesThisMonth < limits.maxExpensesPerMonth
  const canAddWorkspace  = workspacesCount   < limits.maxWorkspaces

  return NextResponse.json({
    plan,
    limits,
    expensesThisMonth,
    workspacesCount,
    canAddExpenses,
    canAddWorkspace,
  })
}
