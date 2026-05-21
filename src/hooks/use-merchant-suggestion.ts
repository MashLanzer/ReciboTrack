"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "./use-auth"

/**
 * Given a merchant name (trimmed, case-insensitive prefix), returns the most
 * recently-used category for that merchant across the user's expenses.
 *
 * Only fires when `merchant` has ≥ 3 characters.
 */
export function useMerchantSuggestion(merchant: string) {
  const { user } = useAuth()
  const normalized = merchant.trim().toLowerCase()

  return useQuery({
    queryKey: ["merchant-suggestion", user?.uid, normalized],
    enabled: !!user && normalized.length >= 3,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      if (!user || normalized.length < 3) return null

      // Fetch last 50 expenses and filter client-side for case-insensitive match
      const res = await apiFetch("/api/expenses?limit=50")
      if (!res.ok) return null
      const expenses = await res.json() as Array<{ merchant: string; category: string }>

      const counts: Record<string, number> = {}
      for (const e of expenses) {
        if (
          typeof e.merchant === "string" &&
          e.merchant.toLowerCase().includes(normalized) &&
          typeof e.category === "string"
        ) {
          counts[e.category] = (counts[e.category] ?? 0) + 1
        }
      }

      if (Object.keys(counts).length === 0) return null
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
      return best[0] as string
    },
  })
}
