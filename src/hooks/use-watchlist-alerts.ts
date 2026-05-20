"use client"

import { useEffect } from "react"
import { useWatchlist } from "./use-watchlist"
import { useCategories } from "./use-categories"
import { useExpensesForMonth } from "./use-expenses"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"

/**
 * Watches the user's category watchlist and fires toast alerts when monthly
 * spend crosses 80% or 100% of an entry's alertThreshold.
 * Uses sessionStorage for dedup (same strategy as useCategoryLimits).
 */
export function useWatchlistAlerts() {
  const { entries } = useWatchlist()
  const { data: categories = [] } = useCategories()
  const now = new Date()
  const { data: expenses = [] } = useExpensesForMonth(now.getFullYear(), now.getMonth() + 1)

  function isAlerted(key: string): boolean {
    try { return sessionStorage.getItem(`watchlist-alert:${key}`) === "1" } catch { return false }
  }
  function markAlerted(key: string) {
    try { sessionStorage.setItem(`watchlist-alert:${key}`, "1") } catch {}
  }

  useEffect(() => {
    const entriesWithThreshold = entries.filter(
      (e) => e.alertThreshold && e.alertThreshold > 0
    )
    if (!entriesWithThreshold.length || !expenses.length) return

    // Build spend map for this month
    const spendMap: Record<string, number> = {}
    expenses.forEach((e) => {
      spendMap[e.category] = (spendMap[e.category] ?? 0) + e.total
    })

    for (const entry of entriesWithThreshold) {
      const limit = entry.alertThreshold!
      const spent = spendMap[entry.categoryId] ?? 0
      const pct = spent / limit
      const cat = categories.find((c) => c.id === entry.categoryId)
      const name = cat ? `${cat.icon} ${cat.name}` : entry.categoryId
      const yearMonth = `${now.getFullYear()}-${now.getMonth()}`

      const key100 = `100:${entry.categoryId}:${yearMonth}`
      const key80  = `80:${entry.categoryId}:${yearMonth}`

      if (pct >= 1 && !isAlerted(key100)) {
        markAlerted(key100)
        toast.error(`⚠️ Límite superado en vigilancia: ${name}`, {
          description: `Llevas ${formatCurrency(spent)} de ${formatCurrency(limit)} este mes`,
          duration: 8000,
        })
      } else if (pct >= 0.8 && pct < 1 && !isAlerted(key80)) {
        markAlerted(key80)
        toast.warning(`👁️ Cerca del límite vigilado: ${name}`, {
          description: `Has usado el ${Math.round(pct * 100)}% (${formatCurrency(spent)} / ${formatCurrency(limit)})`,
          duration: 6000,
        })
      }
    }
  }, [entries, expenses, categories])
}
