"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"

export interface ExpenseTemplate {
  id: string
  name: string
  merchant: string
  category: string
  total: number
  subtotal: number
  tax: number
  paymentMethod: string | null
  currency: string
  notes: string
  tags: string[]
  useCount: number
  lastUsed: Timestamp | null
  createdAt: Timestamp
}

export type TemplateInput = Omit<ExpenseTemplate, "id" | "useCount" | "lastUsed" | "createdAt">

function rowToTemplate(row: Record<string, unknown>): ExpenseTemplate {
  return {
    id:            row.id as string,
    name:          (row.name as string) ?? (row.merchant as string),
    merchant:      row.merchant as string,
    category:      (row.category as string) ?? "",
    total:         Number(row.total),
    subtotal:      Number(row.subtotal),
    tax:           Number(row.tax),
    paymentMethod: (row.paymentMethod as string) ?? null,
    currency:      (row.currency as string) ?? "USD",
    notes:         (row.notes as string) ?? "",
    tags:          (row.tags as string[]) ?? [],
    useCount:      Number(row.useCount ?? 0),
    lastUsed:      null,
    createdAt:     row.createdAt ? Timestamp.fromDate(new Date(row.createdAt as string)) : Timestamp.now(),
  }
}

export function useTemplates() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["templates", user?.uid],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!user) return [] as ExpenseTemplate[]
      const res = await apiFetch("/api/templates")
      if (!res.ok) throw new Error("Error cargando plantillas")
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToTemplate)
    },
  })
}

export function useAddTemplate() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: TemplateInput) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch("/api/templates", { method: "POST", body: JSON.stringify(input) })
      if (!res.ok) throw new Error("Error al crear plantilla")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates", user?.uid] }),
  })
}

export function useDeleteTemplate() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/templates/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar plantilla")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates", user?.uid] }),
  })
}

export function useIncrementTemplateUse() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      // Leer el count actual del cache para incrementar
      const cached = queryClient.getQueryData<ExpenseTemplate[]>(["templates", user.uid]) ?? []
      const template = cached.find((t) => t.id === id)
      const useCount = (template?.useCount ?? 0) + 1
      const res = await apiFetch(`/api/templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ useCount }),
      })
      if (!res.ok) throw new Error("Error al incrementar uso")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates", user?.uid] }),
  })
}

export function useUpdateTemplate() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<TemplateInput> }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/templates/${id}`, { method: "PATCH", body: JSON.stringify(input) })
      if (!res.ok) throw new Error("Error al actualizar plantilla")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates", user?.uid] }),
  })
}
