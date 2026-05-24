"use client"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"

export interface ExpenseHistoryEntry {
  id: string
  field: string
  oldValue: string | null
  newValue: string | null
  changedAt: string
}

export function useExpenseHistory(expenseId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["expense-history", expenseId],
    queryFn: () => apiFetch(`/api/expenses/${expenseId}/history`).then(r => r.history as ExpenseHistoryEntry[]),
    enabled: !!user && !!expenseId,
  })
}
