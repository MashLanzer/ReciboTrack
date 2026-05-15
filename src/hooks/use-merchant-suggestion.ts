"use client"

import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore"
import { useQuery } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
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
    staleTime: 1000 * 60 * 10, // 10 min cache — merchant→category rarely changes
    queryFn: async () => {
      if (!user || normalized.length < 3) return null

      // Firestore doesn't support case-insensitive queries, so we search for
      // exact lowercase match on a normalizedMerchant field. Since we don't
      // store that field, we fetch recent expenses and filter client-side.
      // Limit to 50 recent expenses to keep it fast.
      const col = collection(getFirebaseDb(), "users", user.uid, "expenses")
      const q = query(col, orderBy("date", "desc"), limit(50))
      const snap = await getDocs(q)

      // Count category occurrences for this merchant (case-insensitive)
      const counts: Record<string, number> = {}
      for (const d of snap.docs) {
        const data = d.data()
        if (
          typeof data.merchant === "string" &&
          data.merchant.toLowerCase().includes(normalized) &&
          typeof data.category === "string"
        ) {
          counts[data.category] = (counts[data.category] ?? 0) + 1
        }
      }

      if (Object.keys(counts).length === 0) return null

      // Return the most frequent category
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
      return best[0] as string
    },
  })
}
