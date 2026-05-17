"use client"

import { useEffect, useRef } from "react"
import { format, differenceInDays } from "date-fns"
import { es } from "date-fns/locale"
import { useCategoryBudgets } from "@/hooks/use-category-budgets"
import { useExpensesForMonth } from "@/hooks/use-expenses"
import { useFlaggedExpenses } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { useRecurring } from "@/hooks/use-recurring"
import { toDate } from "@/lib/utils"
import { isAlertSnoozed } from "@/lib/alert-snooze"

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
  const today = format(now, "yyyy-MM-dd")

  const { data: budgets = [] } = useCategoryBudgets(monthStr)
  const { data: expenses = [] } = useExpensesForMonth(year, month)
  const { data: categories = [] } = useCategories()
  const { data: recurring = [] } = useRecurring()
  const { data: flagged = [] } = useFlaggedExpenses()

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

        // Check snooze (Feature C)
        if (isAlertSnoozed(`budget:${budget.categoryId}`)) continue

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

    // ── Feature E: Bookmark reminders (flagged > 5 days ago) ─────────────────
    for (const e of flagged) {
      if (!e.flaggedAt) continue
      const flaggedDate = (e.flaggedAt as { toDate(): Date }).toDate()
      const daysAgo = differenceInDays(now, flaggedDate)
      if (daysAgo < 5) continue
      if (isAlertSnoozed(`flag:${e.id}`)) continue
      const remindKey = `flag-remind:${e.id}:${today}`
      if (sessionFired(remindKey)) continue
      fireNotification(
        `🔖 Pendiente sin resolver`,
        `${e.merchant} fue marcado hace ${daysAgo} día${daysAgo > 1 ? "s" : ""}`
      )
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

    // ── 3. Financial anniversary alerts (recurring > 365 days old) ───────────
    const currentYear = now.getFullYear()
    for (const item of recurring) {
      if (!item.createdAt) continue
      const createdDate = toDate(item.createdAt)
      const daysSinceCreation = differenceInDays(now, createdDate)
      if (daysSinceCreation < 365) continue

      const key = `anniv:${item.id}:${currentYear}`
      if (sessionFired(key)) continue

      const years = Math.floor(daysSinceCreation / 365)
      const totalPaid = item.total * years * (
        item.frequency === "weekly"   ? 52 :
        item.frequency === "biweekly" ? 26 :
        item.frequency === "monthly"  ? 12 : 1
      )

      fireNotification(
        `🎂 '${item.merchant}' lleva ${years} año${years > 1 ? "s" : ""} contigo`,
        `Te ha costado aprox. ${totalPaid.toFixed(2)} ${item.currency} en total.`
      )
    }
  }, [budgets, expenses, categories, recurring, flagged, monthStr, today])

  void processedRef // suppress unused warning

  return null
}
