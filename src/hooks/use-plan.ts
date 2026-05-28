"use client"

import { useQuery } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"
import type { Plan } from "@/lib/plan-config"
import { PLAN_LIMITS, planHasAccess } from "@/lib/plan-config"

export interface PlanData {
  plan:               Plan
  limits:             typeof PLAN_LIMITS[Plan]
  expensesThisMonth:  number
  workspacesCount:    number
  ocrScansThisMonth:  number
  canAddExpenses:     boolean
  canAddWorkspace:    boolean
  canOcr:             boolean
}

export function usePlan() {
  const { user } = useAuth()

  return useQuery<PlanData>({
    queryKey: ["plan"],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const res = await apiFetch("/api/plan")
      if (!res.ok) throw new Error("Error cargando plan")
      return res.json() as Promise<PlanData>
    },
  })
}

/**
 * Devuelve true si el usuario tiene acceso al tier requerido.
 * ej: useHasPlan("premium") → true si el user es premium
 *     useHasPlan("pro")     → true si el user es pro O premium
 */
export function useHasPlan(required: Plan): boolean {
  const { data } = usePlan()
  if (!data) return false
  return planHasAccess(data.plan, required)
}
