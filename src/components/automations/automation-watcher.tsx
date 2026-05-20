"use client"

import { useEffect, useRef } from "react"
import { useAutomations } from "@/hooks/use-automations"
import { useUserSettings } from "@/hooks/use-user-settings"
import { useAuth } from "@/hooks/use-auth"
import { fireWebhook } from "@/lib/webhook"
import { doc, updateDoc, arrayUnion } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
import { toast } from "sonner"
import type { Expense } from "@/types"

interface AutomationWatcherProps {
  /**
   * Pass the most recent expense whenever a new one is created,
   * to trigger expense_over and tag automations.
   */
  latestExpense?: Expense | null
  /** Current month total for budget_pct checks */
  monthTotal?: number
}

export function AutomationWatcher({ latestExpense, monthTotal = 0 }: AutomationWatcherProps) {
  const { data: rules = [] } = useAutomations()
  const { data: settings } = useUserSettings()
  const { user } = useAuth()
  const processedExpenseId = useRef<string | null>(null)

  useEffect(() => {
    if (!latestExpense || !user) return
    if (processedExpenseId.current === latestExpense.id) return
    processedExpenseId.current = latestExpense.id

    const enabled = rules.filter((r) => r.enabled)

    for (const rule of enabled) {
      if (rule.trigger === "expense_over") {
        if (latestExpense.total > rule.triggerValue) {
          fireRuleAction(rule.action, rule.actionValue, {
            expense: latestExpense,
            uid: user.uid,
            message: `Gasto de ${latestExpense.total.toFixed(2)} supera ${rule.triggerValue}`,
          })
        }
      }

      if (rule.trigger === "category_over" && rule.triggerCategory) {
        if (
          latestExpense.category === rule.triggerCategory &&
          latestExpense.total > rule.triggerValue
        ) {
          fireRuleAction(rule.action, rule.actionValue, {
            expense: latestExpense,
            uid: user.uid,
            message: `Gasto en "${rule.triggerCategory}" de ${latestExpense.total.toFixed(2)} supera ${rule.triggerValue}`,
          })
        }
      }
    }
  }, [latestExpense, rules, user])

  // Budget percentage watcher
  const lastBudgetPctFired = useRef<number | null>(null)

  useEffect(() => {
    const budget = settings?.monthlyBudget
    if (!budget || budget <= 0 || !rules.length) return

    const pct = (monthTotal / budget) * 100
    const enabled = rules.filter((r) => r.enabled && r.trigger === "budget_pct")

    for (const rule of enabled) {
      if (pct >= rule.triggerValue) {
        // Only fire once per crossing
        const key = Math.floor(pct / rule.triggerValue)
        if (lastBudgetPctFired.current === key) continue
        lastBudgetPctFired.current = key
        fireRuleAction(rule.action, rule.actionValue, {
          message: `Presupuesto al ${pct.toFixed(0)}% (${monthTotal.toFixed(2)} / ${budget})`,
        })
      }
    }
  }, [monthTotal, settings?.monthlyBudget, rules])

  return null
}

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
                  total: payload.expense.total,
                  currency: payload.expense.currency,
                  category: payload.expense.category,
                }
              : {}),
          },
        })
      }
      break

    case "tag": {
      // Apply tag directly to the expense document in Firestore
      const tag = value.trim().toLowerCase()
      if (tag && payload.expense?.id && payload.uid) {
        const expenseRef = doc(
          getFirebaseDb(),
          "users", payload.uid, "expenses", payload.expense.id
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
