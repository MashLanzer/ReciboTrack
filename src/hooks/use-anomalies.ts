"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"

export interface AnomalyExpense {
  id:             string
  description:    string
  amount:         number
  currency:       string
  category:       string
  date:           string
  avgForCategory: number
  ratio:          number
}

interface AnomaliesResponse {
  anomalies: AnomalyExpense[]
}

export function useAnomalies() {
  return useQuery<AnomalyExpense[]>({
    queryKey: ["anomalies"],
    staleTime: 1000 * 60 * 5, // 5 minutos
    queryFn: async () => {
      const res = await apiFetch("/api/anomalies")
      if (!res.ok) return []
      const data = (await res.json()) as AnomaliesResponse
      return data.anomalies ?? []
    },
  })
}
