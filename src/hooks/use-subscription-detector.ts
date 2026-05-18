"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"
import { useRecurring } from "./use-recurring"
import type { Expense, RecurringFrequency } from "@/types"
import { differenceInDays, startOfDay } from "date-fns"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DetectedSubscription {
  merchant: string
  category: string
  currency: string
  /** Median amount across occurrences */
  amount: number
  /** Detected period in days */
  periodDays: number
  /** Best-matching frequency label */
  frequency: RecurringFrequency
  /** Number of times seen */
  occurrences: number
  /** Date of last charge */
  lastSeen: Date
  /** Is already in recurring templates? */
  alreadyTracked: boolean
}

// ─── Algorithm helpers ────────────────────────────────────────────────────────

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function classifyPeriod(days: number): RecurringFrequency | null {
  if (days >= 6 && days <= 8)   return "weekly"
  if (days >= 13 && days <= 16) return "biweekly"
  if (days >= 26 && days <= 35) return "monthly"
  if (days >= 340 && days <= 390) return "yearly"
  return null
}

function normalize(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ")
}

function amountsAreConsistent(amounts: number[]): boolean {
  if (amounts.length < 2) return true
  const med = median(amounts)
  // Allow 20% variance (price changes, currency fluctuations)
  return amounts.every((a) => Math.abs(a - med) / med <= 0.20)
}

// ─── Detection hook ───────────────────────────────────────────────────────────

function useRecentExpenses() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["expenses-detector", user?.uid],
    enabled: !!user,
    staleTime: 1000 * 60 * 10, // 10 min cache
    queryFn: async () => {
      if (!user) return []
      const col = collection(getFirebaseDb(), "users", user.uid, "expenses")
      const q = query(col, orderBy("date", "desc"), limit(300))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)
    },
  })
}

export function useSubscriptionDetector() {
  const { data: expenses = [], isLoading: expLoading } = useRecentExpenses()
  const { data: templates = [], isLoading: tplLoading } = useRecurring()

  const detections = useMemo((): DetectedSubscription[] => {
    if (expenses.length < 4) return []

    // Group by normalized merchant name
    const groups = new Map<string, { dates: Date[]; amounts: number[]; category: string; currency: string }>()

    for (const e of expenses) {
      const key = normalize(e.merchant)
      if (!key) continue
      if (!e.date || typeof e.date.toDate !== "function") continue
      const date = startOfDay(e.date.toDate())
      if (!groups.has(key)) {
        groups.set(key, { dates: [], amounts: [], category: e.category, currency: e.currency })
      }
      const g = groups.get(key)!
      g.dates.push(date)
      g.amounts.push(e.total)
    }

    const results: DetectedSubscription[] = []
    const trackedMerchants = new Set(templates.map((t) => normalize(t.merchant)))

    for (const [merchant, { dates, amounts, category, currency }] of groups) {
      if (dates.length < 2) continue

      // Sort dates ascending
      const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())

      // Compute gaps between consecutive occurrences
      const gaps: number[] = []
      for (let i = 1; i < sorted.length; i++) {
        gaps.push(differenceInDays(sorted[i], sorted[i - 1]))
      }

      if (gaps.length === 0) continue

      const medianGap = median(gaps)
      const frequency = classifyPeriod(medianGap)
      if (!frequency) continue

      // Check gaps are consistent (within 30% of median)
      const gapsConsistent = gaps.every((g) => Math.abs(g - medianGap) / medianGap <= 0.30)
      if (!gapsConsistent && dates.length < 4) continue

      // Check amounts are consistent
      if (!amountsAreConsistent(amounts)) continue

      // Need at least 2 occurrences (3+ = high confidence)
      if (dates.length < 2) continue

      results.push({
        merchant: expenses.find((e) => normalize(e.merchant) === merchant)?.merchant ?? merchant,
        category,
        currency,
        amount: median(amounts),
        periodDays: Math.round(medianGap),
        frequency,
        occurrences: dates.length,
        lastSeen: sorted[sorted.length - 1],
        alreadyTracked: trackedMerchants.has(merchant),
      })
    }

    // Sort: untracked first, then by occurrences desc
    return results.sort((a, b) => {
      if (a.alreadyTracked !== b.alreadyTracked) return a.alreadyTracked ? 1 : -1
      return b.occurrences - a.occurrences
    })
  }, [expenses, templates])

  return {
    detections,
    isLoading: expLoading || tplLoading,
    untracked: detections.filter((d) => !d.alreadyTracked),
  }
}
