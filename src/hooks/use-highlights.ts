"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"
import {
  startOfYear, endOfYear, startOfMonth, endOfMonth,
  differenceInDays, getMonth,
} from "date-fns"
import type { Expense } from "@/types"
import type { Income } from "./use-income"

export interface Highlight {
  id: string
  type: string
  title: string
  value: string
  description?: string
  date: Timestamp
  icon: string
  pinned: boolean
}

function rowToHighlight(row: Record<string, unknown>): Highlight {
  return {
    id:          row.id as string,
    type:        row.type as string,
    title:       (row.title as string) ?? "",
    value:       (row.value as string) ?? "",
    description: (row.description as string) ?? undefined,
    date:        row.date
      ? Timestamp.fromDate(new Date(row.date as string))
      : Timestamp.now(),
    icon:        (row.icon as string) ?? "",
    pinned:      Boolean(row.pinned ?? false),
  }
}

export function useHighlights() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["highlights", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as Highlight[]
      const res = await apiFetch("/api/highlights")
      if (!res.ok) return [] as Highlight[]
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToHighlight)
    },
  })
}

export function usePinHighlight() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/highlights/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ pinned }),
      })
      if (!res.ok) throw new Error("Error al actualizar highlight")
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["highlights", user?.uid] }),
  })
}

/** Computes achievement highlights from expenses + income data and writes them to Supabase */
export function useGenerateHighlights() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      expenses,
      income,
    }: {
      expenses: Expense[]
      income: Income[]
    }) => {
      if (!user) throw new Error("No autenticado")
      const now = new Date()
      const yearStart = startOfYear(now)
      const yearEnd   = endOfYear(now)

      // Filter to current year
      const yearExp = expenses.filter((e) => {
        const d = e.date.toDate()
        return d >= yearStart && d <= yearEnd
      })
      const yearInc = income.filter((inc) => {
        const d = inc.date.toDate()
        return d >= yearStart && d <= yearEnd
      })

      const highlights: Array<{
        key: string
        type: string
        title: string
        value: string
        description?: string
        icon: string
        pinned: boolean
      }> = []

      // ── Mejor mes: lowest expense/income ratio ──────────────────────────
      const monthsElapsed = getMonth(now) + 1
      let bestMonthLabel = ""
      let bestMonthRatio = Infinity
      for (let m = 0; m < monthsElapsed; m++) {
        const mStart = startOfMonth(new Date(now.getFullYear(), m))
        const mEnd   = endOfMonth(new Date(now.getFullYear(), m))
        const mExp   = yearExp.filter((e) => { const d = e.date.toDate(); return d >= mStart && d <= mEnd }).reduce((s, e) => s + e.total, 0)
        const mInc   = yearInc.filter((inc) => { const d = inc.date.toDate(); return d >= mStart && d <= mEnd }).reduce((s, inc) => s + inc.amount, 0)
        if (mInc > 0 && mExp / mInc < bestMonthRatio) {
          bestMonthRatio = mExp / mInc
          bestMonthLabel = new Date(now.getFullYear(), m).toLocaleDateString("es", { month: "long" })
        }
      }
      if (bestMonthLabel) {
        highlights.push({
          key:         "best_month",
          type:        "best_month",
          title:       "Mejor mes del año",
          value:       bestMonthLabel,
          description: `Ratio gasto/ingreso más bajo: ${Math.round(bestMonthRatio * 100)}%`,
          icon:        "🏆",
          pinned:      false,
        })
      }

      // ── Récord de ahorro ────────────────────────────────────────────────
      let bestSavingPct = 0
      let bestSavingMonth = ""
      for (let m = 0; m < monthsElapsed; m++) {
        const mStart = startOfMonth(new Date(now.getFullYear(), m))
        const mEnd   = endOfMonth(new Date(now.getFullYear(), m))
        const mExp   = yearExp.filter((e) => { const d = e.date.toDate(); return d >= mStart && d <= mEnd }).reduce((s, e) => s + e.total, 0)
        const mInc   = yearInc.filter((inc) => { const d = inc.date.toDate(); return d >= mStart && d <= mEnd }).reduce((s, inc) => s + inc.amount, 0)
        if (mInc > 0) {
          const savingPct = ((mInc - mExp) / mInc) * 100
          if (savingPct > bestSavingPct) {
            bestSavingPct = savingPct
            bestSavingMonth = new Date(now.getFullYear(), m).toLocaleDateString("es", { month: "long" })
          }
        }
      }
      if (bestSavingMonth && bestSavingPct > 0) {
        highlights.push({
          key:         "savings_record",
          type:        "savings_record",
          title:       "Récord de ahorro",
          value:       `${Math.round(bestSavingPct)}% ahorrado`,
          description: `Tu mejor mes de ahorro fue ${bestSavingMonth}`,
          icon:        "💰",
          pinned:      false,
        })
      }

      // ── Racha más larga bajo el promedio diario ─────────────────────────
      if (yearExp.length > 0) {
        const dailyAvg = yearExp.reduce((s, e) => s + e.total, 0) / Math.max(differenceInDays(now, yearStart), 1)
        const byDay = new Map<string, number>()
        yearExp.forEach((e) => {
          const key = e.date.toDate().toISOString().split("T")[0]
          byDay.set(key, (byDay.get(key) ?? 0) + e.total)
        })
        const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))
        let maxStreak = 0, curStreak = 0
        for (const [, total] of days) {
          if (total < dailyAvg) { curStreak++; maxStreak = Math.max(maxStreak, curStreak) }
          else curStreak = 0
        }
        if (maxStreak >= 3) {
          highlights.push({
            key:         "longest_streak",
            type:        "longest_streak",
            title:       "Racha más larga",
            value:       `${maxStreak} días`,
            description: "Días consecutivos bajo el promedio diario",
            icon:        "🔥",
            pinned:      false,
          })
        }
      }

      // Escribir todos los highlights via API (upsert)
      await Promise.all(highlights.map((h) =>
        apiFetch("/api/highlights", { method: "POST", body: JSON.stringify(h) })
      ))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["highlights", user?.uid] }),
  })
}
