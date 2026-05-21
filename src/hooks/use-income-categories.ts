"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "./use-auth"

export interface IncomeCategory {
  id: string
  name: string
  emoji: string
  color: string
  createdAt: Timestamp
}

export interface IncomeCategoryInput {
  name: string
  emoji: string
  color: string
}

/** Default built-in categories (shown when user has none yet) */
export const DEFAULT_INCOME_CATEGORIES: Omit<IncomeCategory, "id" | "createdAt">[] = [
  { name: "Nómina",      emoji: "💼", color: "#3b82f6" },
  { name: "Freelance",   emoji: "💻", color: "#8b5cf6" },
  { name: "Inversiones", emoji: "📈", color: "#22c55e" },
  { name: "Alquiler",    emoji: "🏠", color: "#f59e0b" },
  { name: "Venta",       emoji: "🛒", color: "#ec4899" },
  { name: "Bono",        emoji: "🎁", color: "#14b8a6" },
  { name: "Reembolso",   emoji: "↩️",  color: "#64748b" },
  { name: "Otro",        emoji: "📦", color: "#6b7280" },
]

function rowToCategory(row: Record<string, unknown>): IncomeCategory {
  return {
    id:        row.id as string,
    name:      row.name as string,
    emoji:     (row.emoji as string) ?? "",
    color:     (row.color as string) ?? "",
    createdAt: row.createdAt
      ? Timestamp.fromDate(new Date(row.createdAt as string))
      : Timestamp.now(),
  }
}

export function useIncomeCategories() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["income-categories", user?.uid],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user) return [] as IncomeCategory[]
      const res = await apiFetch("/api/income-categories")
      if (!res.ok) return [] as IncomeCategory[]
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToCategory)
    },
  })
}

export function useAddIncomeCategory() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: IncomeCategoryInput) => {
      if (!user) throw new Error("No auth")
      const res = await apiFetch("/api/income-categories", {
        method: "POST",
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error("Error al crear categoría")
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["income-categories", user?.uid] }),
  })
}

export function useUpdateIncomeCategory() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<IncomeCategoryInput> }) => {
      if (!user) throw new Error("No auth")
      const res = await apiFetch(`/api/income-categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error("Error al actualizar categoría")
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["income-categories", user?.uid] }),
  })
}

export function useDeleteIncomeCategory() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No auth")
      const res = await apiFetch(`/api/income-categories/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar categoría")
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["income-categories", user?.uid] }),
  })
}
