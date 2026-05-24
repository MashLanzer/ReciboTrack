"use client"

import { useMemo } from "react"
import { subDays, differenceInDays } from "date-fns"
import { useExpensesPeriod } from "@/hooks/use-expenses"
import type { Expense } from "@/types"

/**
 * Returns potential duplicate expenses given a merchant + amount.
 * Uses last-7-days expenses loaded via useExpensesPeriod.
 * Flags expenses within 3 days that are from a similar merchant and within 5% of the amount.
 */
export function useDuplicateDetection(
  merchant: string,
  amount: number,
  currentDate?: Date
): Expense[] {
  const now = currentDate ?? new Date()
  const sevenDaysAgo = subDays(now, 7)

  const { data: recentExpenses = [] } = useExpensesPeriod(sevenDaysAgo, now)

  return useMemo(() => {
    if (!merchant || amount <= 0) return []

    const merchantLower = merchant.toLowerCase()

    return recentExpenses.filter((e) => {
      // Fuzzy merchant match: one contains the other
      const eMerchantLower = e.merchant.toLowerCase()
      const merchantMatch =
        eMerchantLower.includes(merchantLower) || merchantLower.includes(eMerchantLower)

      if (!merchantMatch) return false

      // Amount within 5%
      const amountMatch =
        Math.abs(e.total - amount) / Math.max(amount, 1) <= 0.05

      if (!amountMatch) return false

      // Within last 3 days
      const expenseDate = e.date.toDate()
      const daysAgo = differenceInDays(now, expenseDate)
      return daysAgo <= 3
    })
  }, [recentExpenses, merchant, amount, now])
}
