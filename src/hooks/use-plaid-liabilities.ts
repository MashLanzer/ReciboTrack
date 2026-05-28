"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import type { LiabilitiesResponse } from "@/app/api/plaid/liabilities/route"

export type { LiabilitiesResponse, CreditCard } from "@/app/api/plaid/liabilities/route"

export function usePlaidLiabilities() {
  return useQuery<LiabilitiesResponse>({
    queryKey: ["plaid-liabilities"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const res = await apiFetch("/api/plaid/liabilities")
      if (res.status === 402) return { credit_cards: [], total_balance: 0, total_limit: null, total_utilization: null }
      if (!res.ok) throw new Error("Error al cargar datos de crédito")
      return res.json() as Promise<LiabilitiesResponse>
    },
  })
}
