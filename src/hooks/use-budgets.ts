"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import type { Budget } from "@/types"
import type { BudgetFormInput } from "@/lib/firebase/schemas"
import { apiFetch } from "@/lib/api-client"

function rowToBudget(row: Record<string, unknown>): Budget {
  return {
    id:              row.id as string,
    categoryId:      row.categoryId as string,
    monthlyLimit:    Number(row.monthlyLimit),
    currency:        row.currency as string,
    rolloverEnabled: (row.rolloverEnabled as boolean) ?? false,
  }
}

export function useBudgets() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["budgets", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as Budget[]
      const res = await apiFetch("/api/budgets")
      if (!res.ok) throw new Error("Error cargando presupuestos")
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToBudget)
    },
  })
}

export function useUpsertBudget() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: BudgetFormInput & { id?: string }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch("/api/budgets", {
        method: "POST",
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? "Error al guardar presupuesto")
      }
      const json = await res.json() as { id: string }
      return json.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budgets", user?.uid] }),
  })
}

export function useDeleteBudget() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/budgets/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar presupuesto")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budgets", user?.uid] }),
  })
}

export function useSetBudgetRollover() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, rolloverEnabled }: { id: string; rolloverEnabled: boolean }) => {
      const res = await apiFetch(`/api/budgets/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ rolloverEnabled }),
      })
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets", user?.uid] }),
  })
}
