"use client"

import { useQuery } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"
import type { Plan } from "@/lib/plan"
import { PLAN_LIMITS } from "@/lib/plan"

export interface PlanData {
  plan: Plan
  limits: typeof PLAN_LIMITS[Plan]
  expensesThisMonth: number
  canAddExpenses: boolean
}

export function usePlan() {
  const { user } = useAuth()

  return useQuery<PlanData>({
    queryKey: ["plan"],
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      const res = await apiFetch("/api/plan")
      if (!res.ok) throw new Error("Error cargando plan")
      return res.json() as Promise<PlanData>
    },
  })
}

export function useIsProFeature(feature: keyof typeof PLAN_LIMITS["free"]) {
  const { data } = usePlan()
  if (!data) return false
  return !(data.limits as typeof PLAN_LIMITS["free"])[feature]
}
