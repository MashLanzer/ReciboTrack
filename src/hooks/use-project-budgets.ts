"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "./use-auth"

/** Maps project name → budget limit (in user's default currency) */
export type ProjectBudgets = Record<string, number>

export function useProjectBudgets() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["project-budgets", user?.uid],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user) return {} as ProjectBudgets
      const res = await apiFetch("/api/project-budgets")
      if (!res.ok) return {} as ProjectBudgets
      return await res.json() as ProjectBudgets
    },
  })
}

export function useSetProjectBudget() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      projectName,
      budget,
    }: {
      projectName: string
      budget: number | null
    }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch("/api/project-budgets", {
        method: "PATCH",
        body: JSON.stringify({ projectName, budget }),
      })
      if (!res.ok) throw new Error("Error al guardar presupuesto")
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["project-budgets", user?.uid] }),
  })
}
