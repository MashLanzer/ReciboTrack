"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { useAuth } from "./use-auth"
import type { TravelBudget } from "@/types"
import { apiFetch } from "@/lib/api-client"

export interface TravelBudgetInput {
  name: string
  emoji: string
  totalLimit: number
  currency: string
  startDate: Date
  endDate: Date
  tags: string[]
}

function rowToTravelBudget(row: Record<string, unknown>): TravelBudget {
  // Dates come as "YYYY-MM-DD" strings
  const toTs = (v: unknown): Timestamp =>
    v ? Timestamp.fromDate(new Date(String(v) + "T12:00:00")) : Timestamp.now()

  return {
    id:         row.id as string,
    name:       row.name as string,
    emoji:      (row.emoji as string) ?? "",
    totalLimit: Number(row.totalLimit),
    currency:   (row.currency as string) ?? "USD",
    startDate:  toTs(row.startDate),
    endDate:    toTs(row.endDate),
    tags:       (row.tags as string[]) ?? [],
    createdAt:  toTs(row.createdAt),
  }
}

export function useTravelBudgets() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["travelBudgets", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as TravelBudget[]
      const res = await apiFetch("/api/travel-budgets")
      if (!res.ok) throw new Error("Error cargando presupuestos de viaje")
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToTravelBudget)
    },
  })
}

export function useAddTravelBudget() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: TravelBudgetInput) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch("/api/travel-budgets", {
        method: "POST",
        body: JSON.stringify({
          ...input,
          startDate: format(input.startDate, "yyyy-MM-dd"),
          endDate:   format(input.endDate,   "yyyy-MM-dd"),
        }),
      })
      if (!res.ok) throw new Error("Error al crear presupuesto de viaje")
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["travelBudgets", user?.uid] }),
  })
}

export function useUpdateTravelBudget() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TravelBudgetInput> }) => {
      if (!user) throw new Error("No autenticado")
      const body: Record<string, unknown> = { ...updates }
      if (updates.startDate) body.startDate = format(updates.startDate, "yyyy-MM-dd")
      if (updates.endDate)   body.endDate   = format(updates.endDate,   "yyyy-MM-dd")

      const res = await apiFetch(`/api/travel-budgets/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Error al actualizar presupuesto de viaje")
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["travelBudgets", user?.uid] }),
  })
}

export function useDeleteTravelBudget() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/travel-budgets/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar presupuesto de viaje")
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["travelBudgets", user?.uid] }),
  })
}
