"use client"

import { useEffect, useRef } from "react"
import { useBudgets } from "./use-budgets"
import { useExpensesForMonth } from "./use-expenses"

const ALERT_THRESHOLD = 0.8

export function useBudgetNotifications() {
  const now = new Date()
  const { data: budgets = [] } = useBudgets()
  const { data: expenses = [] } = useExpensesForMonth(now.getFullYear(), now.getMonth() + 1)
  const notifiedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!("Notification" in window)) return
    if (Notification.permission !== "granted") return
    if (budgets.length === 0 || expenses.length === 0) return

    for (const budget of budgets) {
      const spent = expenses
        .filter((e) => e.category === budget.categoryId)
        .reduce((sum, e) => sum + e.total, 0)

      const ratio = spent / budget.monthlyLimit
      const key = `${budget.id}-${now.getMonth()}`

      if (ratio >= ALERT_THRESHOLD && !notifiedRef.current.has(key)) {
        notifiedRef.current.add(key)
        const pct = Math.round(ratio * 100)
        new Notification("ReciboTrack — Alerta de presupuesto", {
          body: `Has usado el ${pct}% de tu presupuesto en "${budget.categoryId}"`,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: key,
        })
      }
    }
  }, [budgets, expenses, now])
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false
  if (Notification.permission === "granted") return true
  if (Notification.permission === "denied") return false
  const result = await Notification.requestPermission()
  return result === "granted"
}
