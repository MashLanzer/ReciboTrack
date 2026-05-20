"use client"

import { useEffect, useRef } from "react"
import { useAutomations } from "@/hooks/use-automations"
import { useUserSettings } from "@/hooks/use-user-settings"
import { useAuth } from "@/hooks/use-auth"
import { useExpensesForMonth } from "@/hooks/use-expenses"
import { useRecurring } from "@/hooks/use-recurring"
import { fireWebhook } from "@/lib/webhook"
import { doc, updateDoc, arrayUnion } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
import { differenceInDays } from "date-fns"
import { toast } from "sonner"
import type { Expense } from "@/types"

/**
 * Invisible watcher that evaluates automation rules each time data changes.
 *
 * Triggers implemented:
 *  - expense_over    — new expense total > threshold
 *  - category_over   — new expense in category > threshold
 *  - budget_pct      — monthly total crosses % of monthlyBudget
 *  - recurring_due   — recurring payment due within N days
 *
 * Data is fetched internally so no props are needed from the layout.
 */
export function AutomationWatcher() {
  const { data: rules = [] } = useAutomations()
  const { data: settings } = useUserSettings()
  const { user } = useAuth()

  const now = new Date()
  const { data: expenses = [] } = useExpensesForMonth(now.getFullYear(), now.getMonth() + 1)
  const { data: recurring = [] } = useRecurring()

  // ── expense_over / category_over ──────────────────────────────────────────
  // Track which expense IDs have already been evaluated to avoid re-firing.
  // On first render we populate the set with existing IDs (no firing) so only
  // newly added expenses trigger actions in subsequent renders.
  const processedIds = useRef<Set<string>>(new Set())
  const initialized   = useRef(false)

  useEffect(() => {
    if (!expenses.length) return

    if (!initialized.current) {
      // First load — seed the set without evaluating
      expenses.forEach((e) => processedIds.current.add(e.id))
      initialized.current = true
      return
    }

    if (!user || !rules.length) return

    const newExpenses = expenses.filter((e) => !processedIds.current.has(e.id))
    newExpenses.forEach((e) => processedIds.current.add(e.id))

    const enabled = rules.filter((r) => r.enabled)

    for (const expense of newExpenses) {
      for (const rule of enabled) {
        if (rule.trigger === "expense_over") {
          if (expense.total > rule.triggerValue) {
            fireRuleAction(rule.action, rule.actionValue, {
              expense,
              uid: user.uid,
              message: `Gasto de ${expense.total.toFixed(2)} supera ${rule.triggerValue}`,
            })
          }
        }

        if (rule.trigger === "category_over" && rule.triggerCategory) {
          if (
            expense.category === rule.triggerCategory &&
            expense.total > rule.triggerValue
          ) {
            fireRuleAction(rule.action, rule.actionValue, {
              expense,
              uid: user.uid,
              message: `Gasto en "${rule.triggerCategory}" de ${expense.total.toFixed(2)} supera ${rule.triggerValue}`,
            })
          }
        }
      }
    }
  }, [expenses, rules, user])

  // ── budget_pct ────────────────────────────────────────────────────────────
  const monthTotal         = expenses.reduce((s, e) => s + e.total, 0)
  const lastBudgetPctFired = useRef<number | null>(null)

  useEffect(() => {
    const budget = settings?.monthlyBudget
    if (!budget || budget <= 0 || !rules.length || monthTotal === 0) return

    const pct     = (monthTotal / budget) * 100
    const enabled = rules.filter((r) => r.enabled && r.trigger === "budget_pct")

    for (const rule of enabled) {
      if (pct >= rule.triggerValue) {
        const crossingKey = Math.floor(pct / rule.triggerValue)
        if (lastBudgetPctFired.current === crossingKey) continue
        lastBudgetPctFired.current = crossingKey
        fireRuleAction(rule.action, rule.actionValue, {
          message: `Presupuesto al ${pct.toFixed(0)}% (${monthTotal.toFixed(2)} / ${budget})`,
        })
      }
    }
  }, [monthTotal, settings?.monthlyBudget, rules])

  // ── recurring_due ─────────────────────────────────────────────────────────
  // Fire once per (rule × item × due-date) so it doesn't spam on every render.
  const processedRecurring = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!recurring.length || !rules.length) return

    const enabled = rules.filter((r) => r.enabled && r.trigger === "recurring_due")
    if (!enabled.length) return

    for (const item of recurring) {
      const dueDate     = item.nextDueDate.toDate()
      const daysUntilDue = differenceInDays(dueDate, now)

      // Only fire for upcoming (not overdue) payments
      if (daysUntilDue < 0) continue

      for (const rule of enabled) {
        if (daysUntilDue > rule.triggerValue) continue

        const dedupKey = `${rule.id}:${item.id}:${dueDate.toISOString().split("T")[0]}`
        if (processedRecurring.current.has(dedupKey)) continue
        processedRecurring.current.add(dedupKey)

        const dayLabel = daysUntilDue === 0
          ? "hoy"
          : `en ${daysUntilDue} día${daysUntilDue !== 1 ? "s" : ""}`

        fireRuleAction(rule.action, rule.actionValue, {
          message: `"${item.merchant}" vence ${dayLabel} · ${item.total.toFixed(2)} ${item.currency}`,
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurring, rules])

  return null
}

// ── Action dispatcher ─────────────────────────────────────────────────────────

type FirePayload = {
  expense?: Expense
  uid?: string
  message?: string
}

function fireRuleAction(action: string, value: string, payload: FirePayload) {
  switch (action) {
    case "notification":
      toast.info(payload.message ?? "Automatización activada", {
        description: value || undefined,
        duration: 6000,
      })
      break

    case "webhook":
      if (value) {
        void fireWebhook(value, {
          event: "automation",
          ts: new Date().toISOString(),
          data: {
            message: payload.message,
            ...(payload.expense
              ? {
                  merchant: payload.expense.merchant,
                  total:    payload.expense.total,
                  currency: payload.expense.currency,
                  category: payload.expense.category,
                }
              : {}),
          },
        })
      }
      break

    case "tag": {
      const tag = value.trim().toLowerCase()
      if (tag && payload.expense?.id && payload.uid) {
        const expenseRef = doc(
          getFirebaseDb(),
          "users", payload.uid, "expenses", payload.expense.id,
        )
        void updateDoc(expenseRef, { tags: arrayUnion(tag) })
        toast.info(`Etiqueta "${tag}" añadida automáticamente`, {
          description: payload.message,
          duration: 4000,
        })
      }
      break
    }
  }
}
