"use client"

import { useEffect, useRef } from "react"
import { format, differenceInDays } from "date-fns"
import { es } from "date-fns/locale"
import { useCategoryBudgets } from "@/hooks/use-category-budgets"
import { useExpensesForMonth } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { useRecurring } from "@/hooks/use-recurring"
import { toDate } from "@/lib/utils"

/** Debounce key → only fire once per browser session per category / recurring item */
function sessionFired(key: string): boolean {
  try {
    if (sessionStorage.getItem(key)) return true
    sessionStorage.setItem(key, "1")
    return false
  } catch {
    return false
  }
}

function fireNotification(title: string, body: string) {
  if (typeof window === "undefined") return
  if (!("Notification" in window)) return
  if (Notification.permission !== "granted") return
  try {
    new Notification(title, { body, icon: "/icons/icon-192x192.png" })
  } catch {
    // Ignore — some browsers block new Notification() in certain contexts
  }
}

export function BudgetAlertWatcher() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthStr = format(now, "yyyy-MM")

  const { data: budgets = [] } = useCategoryBudgets(monthStr)
  const { data: expenses = [] } = useExpensesForMonth(year, month)
  const { data: categories = [] } = useCategories()
  const { data: recurring = [] } = useRecurring()

  // Track what's already been processed this render cycle
  const processedRef = useRef(false)

  useEffect(() => {
    // ── 1. Category budget alerts (>= 80%) ───────────────────────────────────
    if (budgets.length > 0 && expenses.length >= 0) {
      // Sum expenses per category for this month
      const totals: Record<string, number> = {}
      for (const e of expenses) {
        totals[e.category] = (totals[e.category] ?? 0) + e.total
      }

      for (const budget of budgets) {
        if (budget.amount <= 0) continue
        const spent = totals[budget.categoryId] ?? 0
        const pct = spent / budget.amount

        if (pct < 0.8) continue

        const cat = categories.find((c) => c.id === budget.categoryId)
        const catLabel = cat ? `${cat.icon} ${cat.name}` : budget.categoryId
        const pctDisplay = Math.round(pct * 100)

        const key = `budget-alert:${budget.categoryId}:${monthStr}:${pct >= 1 ? "100" : "80"}`
        if (sessionFired(key)) continue

        if (pct >= 1) {
          fireNotification(
            `Presupuesto superado: ${catLabel}`,
            `Has gastado el ${pctDisplay}% del presupuesto mensual (${spent.toFixed(2)} / ${budget.amount.toFixed(2)} ${budget.currency})`
          )
        } else {
          fireNotification(
            `Presupuesto al ${pctDisplay}%: ${catLabel}`,
            `Has usado ${spent.toFixed(2)} de ${budget.amount.toFixed(2)} ${budget.currency} este mes`
          )
        }
      }
    }

    // ── 2. Recurring expense due-soon alerts (within 2 days) ─────────────────
    for (const item of recurring) {
      const dueDate = toDate(item.nextDueDate)
      const daysUntilDue = differenceInDays(dueDate, now)

      if (daysUntilDue < 0 || daysUntilDue > 2) continue

      const dueDateStr = format(dueDate, "d 'de' MMMM", { locale: es })
      const key = `recurring-alert:${item.id}:${format(dueDate, "yyyy-MM-dd")}`
      if (sessionFired(key)) continue

      const title =
        daysUntilDue === 0
          ? `Gasto recurrente vence hoy: ${item.merchant}`
          : `Gasto recurrente en ${daysUntilDue} día${daysUntilDue > 1 ? "s" : ""}: ${item.merchant}`

      fireNotification(title, `Vence el ${dueDateStr} · ${item.total.toFixed(2)} ${item.currency}`)
    }
  }, [budgets, expenses, categories, recurring, monthStr])

  void processedRef // suppress unused warning

  return null
}
