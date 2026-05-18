"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { useExpensesPeriod } from "./use-expenses"
import { detectGeoPatterns, type GeoInsight } from "@/lib/geo-patterns"
import { subMonths } from "date-fns"

/** Returns geo insights computed client-side from the last 6 months of expenses */
export function useGeoInsights(): {
  insights: GeoInsight[]
  isLoading: boolean
  hasGeoData: boolean
} {
  const { user } = useAuth()
  const now          = useMemo(() => new Date(), [])
  const sixMonthsAgo = useMemo(() => subMonths(now, 6), [now])

  const { data: expenses = [], isLoading } = useExpensesPeriod(sixMonthsAgo, now)

  const insights = useMemo(() => {
    if (!expenses.length) return []
    return detectGeoPatterns(expenses)
  }, [expenses])

  const hasGeoData = useMemo(
    () => expenses.some((e) => !!(e as { geo?: { lat?: number } }).geo?.lat),
    [expenses],
  )

  return { insights, isLoading, hasGeoData }
}

/** Returns only the most impactful insight (for dashboard widget) */
export function useTopGeoInsight(): GeoInsight | null {
  const { insights } = useGeoInsights()
  return insights[0] ?? null
}

export type { GeoInsight }
