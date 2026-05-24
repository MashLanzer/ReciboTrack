"use client"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"

export interface ForecastCategory {
  category: string
  predicted: number
  trend: "up" | "down" | "stable"
}

export interface ForecastMonth {
  month: string
  categories: ForecastCategory[]
}

export interface ForecastData {
  forecast: ForecastMonth[]
  totalPredicted: number[]
  currency: string
}

export function useForecast() {
  const { user } = useAuth()
  return useQuery<ForecastData>({
    queryKey: ["forecast"],
    queryFn: async () => {
      const res = await apiFetch("/api/ai/forecast")
      if (!res.ok) throw new Error("Error cargando proyección")
      return res.json() as Promise<ForecastData>
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
  })
}
