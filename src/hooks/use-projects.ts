"use client"

import { useExpenses } from "./use-expenses"
import { useMemo } from "react"
import { startOfMonth, endOfMonth, subMonths } from "date-fns"

export function useProjects() {
  const { data: result } = useExpenses({
    startDate: startOfMonth(subMonths(new Date(), 5)),
    endDate: endOfMonth(new Date()),
    sort: "date_desc",
  })
  const expenses = result?.expenses ?? []

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
