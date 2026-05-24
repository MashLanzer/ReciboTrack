"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { addWeeks, addMonths, addYears, format } from "date-fns"
import { useAuth } from "./use-auth"
import type { RecurringTemplate, RecurringFrequency, PriceHistoryEntry } from "@/types"
import { apiFetch } from "@/lib/api-client"
import { haptic } from "@/lib/haptic"

interface RecurringInput {
  merchant: string
  category: string
  subtotal: number
  tax: number
  total: number
  paymentMethod: string | null
  currency: string
  notes: string
  tags: string[]
  frequency: RecurringFrequency
  nextDueDate: Date
}

/** Convierte un row de la API al tipo RecurringTemplate (con Timestamps) */
function rowToRecurring(row: Record<string, unknown>): RecurringTemplate {
  // nextDueDate viene como "YYYY-MM-DD"
  const nextDueDateStr = row.nextDueDate as string | null | undefined
  const nextDueDate = nextDueDateStr
    ? Timestamp.fromDate(new Date(nextDueDateStr + "T12:00:00"))
    : Timestamp.now()

  return {
    id:                   row.id as string,
    merchant:             row.merchant as string,
    category:             (row.category as string) ?? "",
    subtotal:             Number(row.subtotal),
    tax:                  Number(row.tax),
    total:                Number(row.total),
    paymentMethod:        (row.paymentMethod as string) ?? null,
    currency:             (row.currency as string) ?? "USD",
    notes:                (row.notes as string) ?? "",
    tags:                 (row.tags as string[]) ?? [],
    frequency:            row.frequency as RecurringFrequency,
    nextDueDate,
    isActive:             (row.isActive as boolean) ?? true,
    createdAt:            row.createdAt
      ? Timestamp.fromDate(new Date(row.createdAt as string))
      : Timestamp.now(),
    lastLinkedExpenseId:  (row.lastLinkedExpenseId as string) ?? undefined,
    lastLinkedAt:         row.lastLinkedAt
      ? Timestamp.fromDate(new Date(row.lastLinkedAt as string))
      : undefined,
    priceHistory:         (row.priceHistory as PriceHistoryEntry[]) ?? [],
  }
}

export function useRecurring() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["recurring", user?.uid],
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      if (!user) return [] as RecurringTemplate[]
      const res = await apiFetch("/api/recurring")
      if (!res.ok) throw new Error("Error cargando recurrentes")
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToRecurring)
    },
  })
}

export function useDueRecurring() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["recurring-due", user?.uid],
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      if (!user) return [] as RecurringTemplate[]
      const res = await apiFetch("/api/recurring")
      if (!res.ok) throw new Error("Error cargando recurrentes vencidos")
      const rows = await res.json() as Record<string, unknown>[]
      const all = rows.map(rowToRecurring)
      const now = Timestamp.now()
      return all.filter((t) => t.isActive && t.nextDueDate.toMillis() <= now.toMillis())
    },
  })
}

export function useAddRecurring() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RecurringInput) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch("/api/recurring", {
        method: "POST",
        body: JSON.stringify({
          ...input,
          nextDueDate: format(input.nextDueDate, "yyyy-MM-dd"),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? "Error al crear recurrente")
      }
      const json = await res.json() as { id: string }
      return json.id
    },
    onSuccess: () => {
      haptic.success()
      queryClient.invalidateQueries({ queryKey: ["recurring", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["recurring-due", user?.uid] })
    },
  })
}

export function useConfirmRecurring() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, frequency }: { id: string; frequency: RecurringFrequency }) => {
      if (!user) throw new Error("No autenticado")
      const now = new Date()
      const nextDue =
        frequency === "weekly"   ? addWeeks(now, 1) :
        frequency === "biweekly" ? addWeeks(now, 2) :
        frequency === "monthly"  ? addMonths(now, 1) :
        addYears(now, 1)

      const res = await apiFetch(`/api/recurring/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ nextDueDate: format(nextDue, "yyyy-MM-dd") }),
      })
      if (!res.ok) throw new Error("Error al confirmar pago")
    },
    onSuccess: () => {
      haptic.medium()
      queryClient.invalidateQueries({ queryKey: ["recurring", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["recurring-due", user?.uid] })
    },
  })
}

export function useSnoozeRecurring() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      const snooze = new Date()
      snooze.setDate(snooze.getDate() + 3)

      const res = await apiFetch(`/api/recurring/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ nextDueDate: format(snooze, "yyyy-MM-dd") }),
      })
      if (!res.ok) throw new Error("Error al posponer")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["recurring-due", user?.uid] })
    },
  })
}

export function useUpdateRecurring() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<RecurringInput> }) => {
      if (!user) throw new Error("No autenticado")
      const body: Record<string, unknown> = { ...input }
      if (input.nextDueDate) body.nextDueDate = format(input.nextDueDate, "yyyy-MM-dd")

      const res = await apiFetch(`/api/recurring/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Error al actualizar recurrente")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["recurring-due", user?.uid] })
    },
  })
}

export function useDeleteRecurring() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/recurring/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar recurrente")
    },
    onSuccess: () => {
      haptic.heavy()
      queryClient.invalidateQueries({ queryKey: ["recurring", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["recurring-due", user?.uid] })
    },
  })
}
