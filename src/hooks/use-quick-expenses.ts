"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import type { QuickExpense, QuickExpenseInput } from "@/types"
import { apiFetch } from "@/lib/api-client"

function rowToQuickExpense(row: Record<string, unknown>): QuickExpense {
  return {
    id:            row.id as string,
    label:         row.label as string,
    merchant:      (row.merchant as string) ?? "",
    amount:        Number(row.amount),
    category:      (row.category as string) ?? "",
    currency:      (row.currency as string) ?? "USD",
    paymentMethod: (row.paymentMethod as string) ?? null,
    tags:          (row.tags as string[]) ?? [],
    icon:          (row.icon as string) ?? "",
    order:         Number(row.order ?? 0),
    createdAt:     row.createdAt ? Timestamp.fromDate(new Date(row.createdAt as string)) : Timestamp.now(),
  }
}

export function useQuickExpenses() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["quickExpenses", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as QuickExpense[]
      const res = await apiFetch("/api/quick-expenses")
      if (!res.ok) throw new Error("Error cargando quick expenses")
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToQuickExpense)
    },
  })
}

export function useAddQuickExpense() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: QuickExpenseInput) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch("/api/quick-expenses", {
        method: "POST",
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error("Error al crear quick expense")
      const json = await res.json() as { id: string }
      return json.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quickExpenses", user?.uid] }),
  })
}

export function useUpdateQuickExpense() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<QuickExpenseInput> }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/quick-expenses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error("Error al actualizar quick expense")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quickExpenses", user?.uid] }),
  })
}

export function useDeleteQuickExpense() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/quick-expenses/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar quick expense")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quickExpenses", user?.uid] }),
  })
}
