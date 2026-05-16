"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { useBudgets } from "./use-budgets"
import { useExpensesForMonth } from "./use-expenses"
import { useCategories } from "./use-categories"
import { formatCurrency } from "@/lib/utils"

// ─── Threshold levels ──────────────────────────────────────────────────────

type AlertLevel = "75" | "90" | "100"

const LEVELS: { level: AlertLevel; pct: number; label: string }[] = [
  { level: "75", pct: 75, label: "75%" },
  { level: "90", pct: 90, label: "90%" },
  { level: "100", pct: 100, label: "100%" },
]

// ─── Dedup keys (stored in localStorage per budget × month × level) ────────

function sentKey(budgetId: string, level: AlertLevel): string {
  const now = new Date()
  return `rt-budget-alert:${budgetId}:${now.getFullYear()}-${now.getMonth()}:${level}`
}

function wasSent(key: string): boolean {
  try { return localStorage.getItem(key) === "1" } catch { return false }
}

function markSent(key: string) {
  try { localStorage.setItem(key, "1") } catch { /* ignore */ }
}

// ─── Push notification ─────────────────────────────────────────────────────

function firePush(title: string, body: string, tag: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return
  try {
    new Notification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag,
      silent: false,
    })
  } catch { /* some browsers block Notification() in certain contexts */ }
}

// ─── In-app toast fallback ─────────────────────────────────────────────────

function fireToast(level: AlertLevel, catName: string, spent: number, limit: number, currency: string) {
  const remaining = limit - spent
  if (level === "100") {
    toast.error(`⚠️ Presupuesto agotado: ${catName}`, {
      description: `Gastado ${formatCurrency(spent, currency)} de ${formatCurrency(limit, currency)}`,
      duration: 8000,
    })
  } else if (level === "90") {
    toast.warning(`🔴 Casi sin presupuesto: ${catName}`, {
      description: `Te quedan ${formatCurrency(remaining, currency)} (has usado el 90%)`,
      duration: 6000,
    })
  } else {
    toast.warning(`💰 Presupuesto al 75%: ${catName}`, {
      description: `Te quedan ${formatCurrency(remaining, currency)} este mes`,
      duration: 5000,
    })
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useBudgetNotifications() {
  const now = new Date()
  const { data: budgets = [] } = useBudgets()
  const { data: expenses = [] } = useExpensesForMonth(now.getFullYear(), now.getMonth() + 1)
  const { data: categories = [] } = useCategories()
  const prevSignature = useRef<string>("")

  useEffect(() => {
    if (budgets.length === 0 || expenses.length === 0) return

    const signature = budgets.map((b) => b.id).join(",") + "|" + expenses.length
    if (signature === prevSignature.current) return
    prevSignature.current = signature

    for (const budget of budgets) {
      if (budget.monthlyLimit <= 0) continue

      const spent = expenses
        .filter((e) => e.category === budget.categoryId)
        .reduce((sum, e) => sum + e.total, 0)

      const pct = (spent / budget.monthlyLimit) * 100
      const cat = categories.find((c) => c.id === budget.categoryId)
      const catName = cat?.name ?? budget.categoryId

      // Check from highest threshold down so we only fire the most critical one per load
      for (const { level, pct: threshold, label } of [...LEVELS].reverse()) {
        if (pct < threshold) continue

        const key = sentKey(budget.id, level)
        if (wasSent(key)) break // highest already sent → lower ones also sent

        // Mark all lower levels as sent too (avoid showing 75% after 90%)
        for (const { level: l, pct: lPct } of LEVELS) {
          if (lPct <= threshold) markSent(sentKey(budget.id, l))
        }

        const remaining = budget.monthlyLimit - spent

        // Push notification (if permission granted)
        const pushTitle =
          level === "100"
            ? "⚠️ Presupuesto agotado"
            : `💰 Presupuesto al ${label}`
        const pushBody =
          level === "100"
            ? `Has superado el presupuesto en "${catName}". Gastado: ${formatCurrency(spent, budget.currency)}`
            : `Llevas el ${Math.round(pct)}% en "${catName}". Quedan ${formatCurrency(remaining, budget.currency)}.`

        firePush(pushTitle, pushBody, key)

        // In-app toast (always shown, no permission needed)
        fireToast(level, catName, spent, budget.monthlyLimit, budget.currency)

        break // only fire the highest matching level
      }
    }
  }, [budgets, expenses, categories])
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false
  if (Notification.permission === "granted") return true
  if (Notification.permission === "denied") return false
  const result = await Notification.requestPermission()
  return result === "granted"
}
