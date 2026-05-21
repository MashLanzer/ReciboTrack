"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Timestamp } from "firebase/firestore"
import { startOfMonth, endOfMonth, format } from "date-fns"
import { useAuth } from "./use-auth"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"

export interface Income {
  id: string
  amount: number
  currency: string
  source: string
  description?: string
  date: Timestamp
  recurring: boolean
  account?: "personal" | "business"
}

export interface IncomeInput {
  amount: number
  currency: string
  source: string
  description?: string
  date: Date
  recurring: boolean
  account?: "personal" | "business"
}

function rowToIncome(row: Record<string, unknown>): Income {
  // date comes as "YYYY-MM-DD"
  const dateTs = row.date
    ? Timestamp.fromDate(new Date(String(row.date) + "T12:00:00"))
    : Timestamp.now()

  return {
    id:          row.id as string,
    amount:      Number(row.amount),
    currency:    (row.currency as string) ?? "USD",
    source:      (row.source as string) ?? "",
    description: (row.description as string) ?? undefined,
    date:        dateTs,
    recurring:   (row.recurring as boolean) ?? false,
    account:     (row.account as "personal" | "business") ?? undefined,
  }
}

export function useIncome(year: number, month: number) {
  const { user } = useAuth()
  const start = startOfMonth(new Date(year, month - 1))
  const end   = endOfMonth(new Date(year, month - 1))
  return useQuery({
    queryKey: ["income", user?.uid, year, month],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as Income[]
      const params = new URLSearchParams({
        startDate: format(start, "yyyy-MM-dd"),
        endDate:   format(end,   "yyyy-MM-dd"),
      })
      const res = await apiFetch(`/api/income?${params}`)
      if (!res.ok) throw new Error("Error cargando ingresos")
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToIncome)
    },
  })
}

export function useIncomePeriod(start: Date, end: Date) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["income", user?.uid, "period", start.toISOString(), end.toISOString()],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as Income[]
      const params = new URLSearchParams({
        startDate: format(start, "yyyy-MM-dd"),
        endDate:   format(end,   "yyyy-MM-dd"),
      })
      const res = await apiFetch(`/api/income?${params}`)
      if (!res.ok) throw new Error("Error cargando ingresos del período")
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToIncome)
    },
  })
}

export function useAddIncome() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: IncomeInput) => {
      if (!user) throw new Error("No auth")
      const res = await apiFetch("/api/income", {
        method: "POST",
        body: JSON.stringify({
          ...input,
          date: format(input.date, "yyyy-MM-dd"),
        }),
      })
      if (!res.ok) throw new Error("Error al añadir ingreso")
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["income", user?.uid] })
      toast.success("Ingreso añadido")
    },
    onError: (err) => {
      console.error("[useAddIncome]", err)
      toast.error("Error al añadir ingreso")
    },
  })
}

export function useDeleteIncome() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No auth")
      const res = await apiFetch(`/api/income/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar ingreso")
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["income", user?.uid] })
      toast.success("Ingreso eliminado")
    },
    onError: (err) => {
      console.error("[useDeleteIncome]", err)
      toast.error("Error al eliminar ingreso")
    },
  })
}
