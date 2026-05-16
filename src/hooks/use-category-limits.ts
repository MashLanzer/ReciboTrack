"use client"

import { useEffect, useRef } from "react"
import { useExpenses } from "./use-expenses"
import { useCategories } from "./use-categories"
import { useUserSettings } from "./use-user-settings"
import { formatCurrency } from "@/lib/utils"
import { startOfMonth, endOfMonth } from "date-fns"
import { toast } from "sonner"

export function useCategoryLimits() {
  const { data: settings } = useUserSettings()
  const { data: categories = [] } = useCategories()
  const now = new Date()
  const { data: result } = useExpenses({
    startDate: startOfMonth(now),
    endDate: endOfMonth(now),
    sort: "date_desc",
  })
  const expenses = result?.expenses ?? []
  const alerted = useRef<Set<string>>(new Set())

  useEffect(() => {
    const limits = settings?.categoryLimits ?? {}
    if (!Object.keys(limits).length) return

    // Group expenses by category
    const totals: Record<string, number> = {}
    expenses.forEach(e => { totals[e.category] = (totals[e.category] ?? 0) + e.total })

    for (const [catId, limit] of Object.entries(limits)) {
      const spent = totals[catId] ?? 0
      const pct = limit > 0 ? spent / limit : 0
      const cat = categories.find(c => c.id === catId)
      const name = cat ? `${cat.icon} ${cat.name}` : catId

      const key100 = `limit:100:${catId}:${now.getFullYear()}-${now.getMonth()}`
      const key80 = `limit:80:${catId}:${now.getFullYear()}-${now.getMonth()}`

      if (pct >= 1 && !alerted.current.has(key100)) {
        alerted.current.add(key100)
        toast.error(`Límite superado: ${name}`, {
          description: `Llevas ${formatCurrency(spent)} de ${formatCurrency(limit)} permitidos este mes`,
          duration: 8000,
        })
      } else if (pct >= 0.8 && pct < 1 && !alerted.current.has(key80)) {
        alerted.current.add(key80)
        toast.warning(`Cerca del límite: ${name}`, {
          description: `Has usado el ${Math.round(pct * 100)}% de tu límite (${formatCurrency(spent)} / ${formatCurrency(limit)})`,
          duration: 6000,
        })
      }
    }
  }, [expenses, settings, categories])
}
