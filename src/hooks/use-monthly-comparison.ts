"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"

export interface MonthlyComparisonData {
  months: string[]
  categories: string[]
  data: Record<string, number[]>
  currency: string
}

export function useMonthlyComparison() {
  return useQuery<MonthlyComparisonData>({
    queryKey: ["monthly-comparison"],
    staleTime: 1000 * 60 * 10, // 10 minutes
    queryFn: async () => {
      const res = await apiFetch("/api/analytics/monthly-comparison")
      if (!res.ok) throw new Error("Error al cargar la comparativa")
      return res.json() as Promise<MonthlyComparisonData>
    },
  })
}
