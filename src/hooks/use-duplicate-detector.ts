"use client"

import { useExpenses } from "./use-expenses"
import { startOfWeek, endOfWeek } from "date-fns"
import type { Expense } from "@/types"

export function useDuplicateDetector() {
  const now = new Date()
  const { data: result } = useExpenses({
    startDate: startOfWeek(now, { weekStartsOn: 1 }),
    endDate: endOfWeek(now, { weekStartsOn: 1 }),
    sort: "date_desc",
  })
  const weekExpenses = result?.expenses ?? []

  function checkDuplicate(candidate: { merchant: string; total: number }): Expense | null {
    return weekExpenses.find(e => {
      const sameMerchant = e.merchant.toLowerCase().trim() === candidate.merchant.toLowerCase().trim()
      const similarAmount = Math.abs(e.total - candidate.total) / Math.max(candidate.total, 1) <= 0.05
      return sameMerchant && similarAmount
    }) ?? null
  }

  return { checkDuplicate }
}
