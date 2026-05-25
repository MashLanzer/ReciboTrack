import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function getGrade(score: number): string {
  if (score >= 90) return "A"
  if (score >= 75) return "B"
  if (score >= 60) return "C"
  if (score >= 40) return "D"
  return "F"
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const sb = getSupabase()
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0]

  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0]
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0]

  const [expensesRes, budgetsRes, incomeRes, goalsRes, expenseWeeksRes] =
    await Promise.all([
      sb
        .from("expenses")
        .select("total")
        .eq("uid", uid)
        .eq("archived", false)
        .gte("date", thirtyDaysAgoStr),
      sb
        .from("budgets")
        .select("monthly_limit")
        .eq("uid", uid),
      sb
        .from("income")
        .select("amount")
        .eq("uid", uid)
        .gte("date", thirtyDaysAgoStr),
      sb
        .from("goals")
        .select("current_amount, target_amount")
        .eq("uid", uid)
        .eq("is_active", true),
      sb
        .from("expenses")
        .select("date")
        .eq("uid", uid)
        .eq("archived", false)
        .gte("date", thirtyDaysAgoStr),
    ])

  const totalExpenses = (expensesRes.data ?? []).reduce(
    (sum, r) => sum + Number(r.total),
    0
  )
  const totalBudget = (budgetsRes.data ?? []).reduce(
    (sum, r) => sum + Number(r.monthly_limit),
    0
  )
  const totalIncome = (incomeRes.data ?? []).reduce(
    (sum, r) => sum + Number(r.amount),
    0
  )

  const goals = goalsRes.data ?? []
  const totalGoals = goals.length
  const completedGoals = goals.filter(
    (g) => Number(g.current_amount) >= Number(g.target_amount)
  ).length

  const expenseDates = new Set(
    (expenseWeeksRes.data ?? []).map((r) => r.date as string)
  )

  const currency = "USD"

  // ── Pillar 1: Ahorro ────────────────────────────────────────────────────────
  let ahorroScore = 0
  let savingsRate = 0
  if (totalIncome > 0) {
    savingsRate = ((totalIncome - totalExpenses) / totalIncome) * 100
    ahorroScore = savingsRate <= 0 ? 0 : savingsRate >= 20 ? 25 : (savingsRate / 20) * 25
  }
  ahorroScore = Math.round(Math.max(0, Math.min(25, ahorroScore)))

  // ── Pillar 2: Presupuesto ───────────────────────────────────────────────────
  let presupuestoScore = 0
  let spentPct = 0
  if (totalBudget > 0) {
    spentPct = (totalExpenses / totalBudget) * 100
    if (spentPct <= 50) {
      presupuestoScore = 25
    } else if (spentPct >= 100) {
      presupuestoScore = 0
    } else {
      presupuestoScore = ((100 - spentPct) / 50) * 25
    }
  }
  presupuestoScore = Math.round(Math.max(0, Math.min(25, presupuestoScore)))

  // ── Pillar 3: Metas ─────────────────────────────────────────────────────────
  let metasScore = 0
  if (totalGoals > 0) {
    metasScore = (completedGoals / totalGoals) * 25
  }
  metasScore = Math.round(Math.max(0, Math.min(25, metasScore)))

  // ── Pillar 4: Consistencia ──────────────────────────────────────────────────
  let weeksWithExpenses = 0
  for (let w = 0; w < 4; w++) {
    const windowEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000)
    const windowStart = new Date(windowEnd.getTime() - 7 * 24 * 60 * 60 * 1000)
    const windowStartStr = windowStart.toISOString().split("T")[0]
    const windowEndStr = windowEnd.toISOString().split("T")[0]
    const hasExpense = [...expenseDates].some(
      (d) => d >= windowStartStr && d <= windowEndStr
    )
    if (hasExpense) weeksWithExpenses++
  }
  const consistenciaScore = Math.round((weeksWithExpenses / 4) * 25)

  const score = ahorroScore + presupuestoScore + metasScore + consistenciaScore
  const grade = getGrade(score)

  return NextResponse.json({
    score,
    grade,
    pillars: [
      {
        name: "Ahorro",
        score: ahorroScore,
        max: 25,
        detail: `Tasa de ahorro: ${Math.round(savingsRate)}%`,
      },
      {
        name: "Presupuesto",
        score: presupuestoScore,
        max: 25,
        detail: `Gastado ${Math.round(spentPct)}% del presupuesto`,
      },
      {
        name: "Metas",
        score: metasScore,
        max: 25,
        detail:
          totalGoals === 0
            ? "Sin metas activas"
            : `${completedGoals} de ${totalGoals} metas activas`,
      },
      {
        name: "Consistencia",
        score: consistenciaScore,
        max: 25,
        detail: `Registro en ${weeksWithExpenses} de 4 semanas`,
      },
    ],
    currency,
  })
}
