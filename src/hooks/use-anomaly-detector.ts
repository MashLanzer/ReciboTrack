"use client"

import { useEffect, useRef } from "react"
import { Timestamp } from "firebase/firestore"
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "./use-auth"
import { useCategories } from "./use-categories"
import { formatCurrency } from "@/lib/utils"
import { subMonths, startOfMonth, endOfMonth } from "date-fns"
import { toast } from "sonner"
import type { Expense } from "@/types"

// Fetch last 4 months of expenses (3 history + current)
function use4MonthExpenses() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["expenses-anomaly", user?.uid],
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      if (!user) return []
      const start = startOfMonth(subMonths(new Date(), 3))
      const res = await apiFetch(`/api/expenses?startDate=${start.toISOString()}&all=true`)
      if (!res.ok) return []
      const { expenses } = await res.json() as { expenses: Record<string, unknown>[] }
      return expenses.map(e => ({
        ...e,
        date: Timestamp.fromDate(new Date(e.date as string)),
      })) as unknown as Expense[]
    },
  })
}

function sentKey(catId: string): string {
  const now = new Date()
  return `rt-anomaly:${catId}:${now.getFullYear()}-${now.getMonth()}`
}
// sessionStorage: alert shows once per browser session but can repeat in future sessions
function wasSent(key: string) {
  try { return sessionStorage.getItem(key) === "1" } catch { return false }
}
function markSent(key: string) {
  try { sessionStorage.setItem(key, "1") } catch { /**/ }
}

export function useAnomalyDetector() {
  const { data: expenses = [] } = use4MonthExpenses()
  const { data: categories = [] } = useCategories()
  const prevSig = useRef("")

  useEffect(() => {
    if (expenses.length < 5) return
    const sig = expenses.length.toString()
    if (sig === prevSig.current) return
    prevSig.current = sig

    const now = new Date()
    const curStart = startOfMonth(now)
    const curEnd   = endOfMonth(now)

    // Build per-category monthly totals for last 3 months
    const catMap = new Map<string, number[]>() // catId → [m-3, m-2, m-1]

    for (let offset = 3; offset >= 1; offset--) {
      const s = startOfMonth(subMonths(now, offset))
      const e = endOfMonth(subMonths(now, offset))
      const monthExpenses = expenses.filter(ex => {
        const d = ex.date.toDate(); return d >= s && d <= e
      })
      const catTotals = new Map<string, number>()
      for (const ex of monthExpenses) {
        catTotals.set(ex.category, (catTotals.get(ex.category) ?? 0) + ex.total)
      }
      for (const [cat, total] of catTotals) {
        if (!catMap.has(cat)) catMap.set(cat, [])
        catMap.get(cat)!.push(total)
      }
    }

    // Current month totals
    const currentExpenses = expenses.filter(ex => {
      const d = ex.date.toDate(); return d >= curStart && d <= curEnd
    })
    const curTotals = new Map<string, number>()
    for (const ex of currentExpenses) {
      curTotals.set(ex.category, (curTotals.get(ex.category) ?? 0) + ex.total)
    }

    // Detect anomalies: current > 2x average of last 3 months
    for (const [catId, history] of catMap) {
      if (history.length < 2) continue
      const avg = history.reduce((a, b) => a + b, 0) / history.length
      if (avg < 10) continue // ignore tiny amounts

      const current = curTotals.get(catId) ?? 0
      if (current < avg * 2) continue

      const key = sentKey(catId)
      if (wasSent(key)) continue
      markSent(key)

      const cat = categories.find(c => c.id === catId)
      const catName = cat?.name ?? catId
      const multiplier = (current / avg).toFixed(1)

      toast.warning(`📈 Gasto inusual en ${catName}`, {
        description: `Llevas ${formatCurrency(current)} este mes — ${multiplier}x tu media histórica (${formatCurrency(avg)})`,
        duration: 8000,
      })
    }
  }, [expenses, categories])
}
