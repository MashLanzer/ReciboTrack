"use client"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"

export interface HealthScorePillar {
  name: string
  score: number
  max: number
  detail: string
}

export interface HealthScore {
  score: number
  grade: string
  pillars: HealthScorePillar[]
  currency: string
}

export function useHealthScore() {
  const { user } = useAuth()
  return useQuery<HealthScore>({
    queryKey: ["health-score"],
    queryFn: async () => {
      const res = await apiFetch("/api/health-score")
      if (!res.ok) throw new Error("Error cargando salud financiera")
      return res.json() as Promise<HealthScore>
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  })
}
