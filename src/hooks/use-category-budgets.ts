"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"

export interface CategoryBudget {
  id: string
  categoryId: string
  amount: number
  currency: string
  month: string // YYYY-MM
}

export interface CategoryBudgetInput {
  categoryId: string
  amount: number
  currency: string
  month: string // YYYY-MM
}

export function useCategoryBudgets(month: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["category-budgets", user?.uid, month],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as CategoryBudget[]
      const res = await apiFetch(`/api/category-budgets?month=${encodeURIComponent(month)}`)
      if (!res.ok) throw new Error("Error cargando presupuestos por categoría")
      return res.json() as Promise<CategoryBudget[]>
    },
  })
}

export function useSetCategoryBudget() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CategoryBudgetInput) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch("/api/category-budgets", {
        method: "POST",
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error("Error al guardar presupuesto de categoría")
      const json = await res.json() as { id: string }
      return json.id
    },
    onSuccess: (_id, input) => {
      queryClient.invalidateQueries({ queryKey: ["category-budgets", user?.uid, input.month] })
    },
  })
}

export function useDeleteCategoryBudget() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, month }: { id: string; month: string }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/category-budgets/${encodeURIComponent(id)}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar presupuesto de categoría")
      return month
    },
    onSuccess: (_result, { month }) => {
      queryClient.invalidateQueries({ queryKey: ["category-budgets", user?.uid, month] })
    },
  })
}
