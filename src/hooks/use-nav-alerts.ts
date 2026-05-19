"use client"

/**
 * Derives navigation alert counts for:
 *  - Overdue recurring payments (nextDueDate < today)
 *  - Exceeded category budgets this month (spent > limit)
 *
 * Returns counts so the caller can decide whether to show a badge.
 * Both queries use already-cached React Query data — no extra network requests.
 */

import { useMemo } from "react"
import { useRecurring } from "./use-recurring"
import { useCategoryBudgets } from "./use-category-budgets"
import { useExpensesForMonth } from "./use-expenses"

export function useNavAlerts() {
  const { data: templates = [] } = useRecurring()

  const now = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1
  const monthStr = `${year}-${String(month).padStart(2, "0")}`

  const { data: budgets   = [] } = useCategoryBudgets(monthStr)
  const { data: expenses  = [] } = useExpensesForMonth(year, month)

  // Overdue = nextDueDate strictly before today (diff < 0)
  const overdueCount = useMemo(() => {
    const today = new Date()
    return templates.filter((t) => {
      const diff = Math.floor(
        (t.nextDueDate.toDate().getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      )
      return diff < 0
    }).length
  }, [templates])

  // Exceeded = any budget where spent > limit
  const exceededCount = useMemo(() => {
    const spendMap = new Map<string, number>()
    for (const e of expenses) {
      spendMap.set(e.category, (spendMap.get(e.category) ?? 0) + e.total)
    }
    return budgets.filter((b) => {
      const spent = spendMap.get(b.categoryId) ?? 0
      return b.amount > 0 && spent > b.amount
    }).length
  }, [budgets, expenses])

  return { overdueCount, exceededCount }
}
