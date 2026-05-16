"use client"

import { useQuery } from "@tanstack/react-query"

// Free API — updates every 24 h, no auth required
const API_URL = "https://open.er-api.com/v6/latest/USD"

export interface ExchangeRates {
  base: "USD"
  rates: Record<string, number>
  updatedAt: string
}

export function useExchangeRates() {
  return useQuery<ExchangeRates>({
    queryKey: ["exchange-rates"],
    staleTime: 1000 * 60 * 60 * 6,   // refresh every 6 h
    gcTime:    1000 * 60 * 60 * 24,   // keep in memory 24 h
    retry: 2,
    queryFn: async () => {
      const res = await fetch(API_URL)
      if (!res.ok) throw new Error("exchange-rates fetch failed")
      const data = await res.json()
      return {
        base: "USD",
        rates: data.rates as Record<string, number>,
        updatedAt: data.time_last_update_utc as string,
      }
    },
  })
}

/** Convert `amount` from `from` currency to `to` currency using the rate table */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number {
  if (from === to) return amount
  const fromRate = rates[from]
  const toRate   = rates[to]
  if (!fromRate || !toRate) return amount        // unknown currency → return as-is
  return (amount / fromRate) * toRate            // convert via USD as pivot
}
