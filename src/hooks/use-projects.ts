"use client"

import { useExpensesPeriod } from "./use-expenses"
import { useMemo } from "react"
import { startOfMonth, endOfMonth, subMonths } from "date-fns"

export function useProjects() {
  // useExpensesPeriod fetches all expenses (no pagination) — ensures all projects are visible
  const now = new Date()
  const expenses = useExpensesPeriod(
    startOfMonth(subMonths(now, 5)),
    endOfMonth(now)
  ).data ?? []

  const projects = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number; lastDate: Date }>()
    expenses.forEach((e) => {
      if (!e.project) return
      const existing = map.get(e.project)
      if (existing) {
        existing.total += e.total
        existing.count++
      } else {
        map.set(e.project, { name: e.project, total: e.total, count: 1, lastDate: e.date.toDate() })
      }
    })
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [expenses])

  // Lista de todos los proyectos únicos para el autocomplete
  const projectNames = [...new Set(expenses.map((e) => e.project).filter(Boolean))] as string[]

  return { projects, projectNames, expenses }
}
