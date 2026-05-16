"use client"

import { useExpensesPeriod } from "./use-expenses"
import { useAuth } from "./use-auth"
import { useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  writeBatch,
  doc,
  Timestamp,
} from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
import { startOfMonth, endOfMonth, subMonths } from "date-fns"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectSummary {
  name: string
  total: number
  count: number
  firstDate: Date
  lastDate: Date
  /** top 3 categories by spend, [{catId, total}] */
  topCategories: { catId: string; total: number }[]
  /** ids of all expenses in this project (needed for rename) */
  expenseIds: string[]
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useProjects() {
  const now = useMemo(() => new Date(), [])
  const expenses = useExpensesPeriod(
    startOfMonth(subMonths(now, 5)),
    endOfMonth(now)
  ).data ?? []

  const projects = useMemo<ProjectSummary[]>(() => {
    const map = new Map<string, {
      total: number
      count: number
      firstDate: Date
      lastDate: Date
      catTotals: Map<string, number>
      expenseIds: string[]
    }>()

    expenses.forEach((e) => {
      if (!e.project) return
      const d = e.date.toDate()
      const existing = map.get(e.project)
      if (existing) {
        existing.total += e.total
        existing.count++
        if (d < existing.firstDate) existing.firstDate = d
        if (d > existing.lastDate)  existing.lastDate  = d
        existing.catTotals.set(e.category, (existing.catTotals.get(e.category) ?? 0) + e.total)
        existing.expenseIds.push(e.id)
      } else {
        map.set(e.project, {
          total: e.total,
          count: 1,
          firstDate: d,
          lastDate: d,
          catTotals: new Map([[e.category, e.total]]),
          expenseIds: [e.id],
        })
      }
    })

    return [...map.entries()]
      .map(([name, v]) => ({
        name,
        total: v.total,
        count: v.count,
        firstDate: v.firstDate,
        lastDate: v.lastDate,
        expenseIds: v.expenseIds,
        topCategories: [...v.catTotals.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([catId, total]) => ({ catId, total })),
      }))
      .sort((a, b) => b.total - a.total)
  }, [expenses])

  // All unique project names (for autocomplete in forms)
  const projectNames = useMemo(
    () => [...new Set(expenses.map((e) => e.project).filter(Boolean))] as string[],
    [expenses]
  )

  return { projects, projectNames, expenses }
}

// ─── Rename project (batch-updates all matching expenses) ─────────────────────

export function useRenameProject() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      expenseIds,
      newName,
    }: {
      expenseIds: string[]
      newName: string
    }) => {
      if (!user) throw new Error("No autenticado")
      if (!newName.trim()) throw new Error("El nombre no puede estar vacío")
      const db = getFirebaseDb()
      const CHUNK = 499 // Firestore batch limit
      for (let i = 0; i < expenseIds.length; i += CHUNK) {
        const batch = writeBatch(db)
        expenseIds.slice(i, i + CHUNK).forEach((id) => {
          const ref = doc(db, "users", user.uid, "expenses", id)
          batch.update(ref, { project: newName.trim(), updatedAt: Timestamp.now() })
        })
        await batch.commit()
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses", user?.uid] })
      qc.invalidateQueries({ queryKey: ["expenses-period", user?.uid] })
    },
  })
}
