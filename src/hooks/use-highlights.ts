"use client"

import {
  collection, doc, getDocs, setDoc, updateDoc, Timestamp,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"
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

function highlightsCol(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "highlights")
}

export function useHighlights() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["highlights", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as Highlight[]
      const snap = await getDocs(highlightsCol(user.uid))
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Highlight)
    },
  })
}

export function usePinHighlight() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      if (!user) throw new Error("No autenticado")
      const ref = doc(getFirebaseDb(), "users", user.uid, "highlights", id)
      await updateDoc(ref, { pinned })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["highlights", user?.uid] }),
  })
}

/** Computes achievement highlights from expenses + income data and writes them to Firestore */
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

      const highlights: Omit<Highlight, "id">[] = []

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
          type: "best_month",
          title: "Mejor mes del año",
          value: bestMonthLabel,
          description: `Ratio gasto/ingreso más bajo: ${Math.round(bestMonthRatio * 100)}%`,
          date: Timestamp.now(),
          icon: "🏆",
          pinned: false,
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
          type: "savings_record",
          title: "Récord de ahorro",
          value: `${Math.round(bestSavingPct)}% ahorrado`,
          description: `Tu mejor mes de ahorro fue ${bestSavingMonth}`,
          date: Timestamp.now(),
          icon: "💰",
          pinned: false,
        })
      }

      // ── Racha más larga bajo el promedio diario ─────────────────────────
      if (yearExp.length > 0) {
        const dailyAvg = yearExp.reduce((s, e) => s + e.total, 0) / Math.max(differenceInDays(now, yearStart), 1)
        // Group by day
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
            type: "longest_streak",
            title: "Racha más larga",
            value: `${maxStreak} días`,
            description: "Días consecutivos bajo el promedio diario",
            date: Timestamp.now(),
            icon: "🔥",
            pinned: false,
          })
        }
      }

      // Write all highlights to Firestore
      for (const h of highlights) {
        const ref = doc(highlightsCol(user.uid), h.type)
        await setDoc(ref, h, { merge: true })
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["highlights", user?.uid] }),
  })
}
