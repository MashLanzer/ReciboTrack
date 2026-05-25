"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"

export interface ExpenseTemplate {
  id: string
  name: string
  merchant: string
  category: string
  amount: number
  currency: string
  account: string
  notes: string
  tags: string[]
  icon: string
  createdAt: string
}

export type ExpenseTemplateInput = Omit<ExpenseTemplate, "id" | "createdAt">

function rowToTemplate(row: Record<string, unknown>): ExpenseTemplate {
  return {
    id:        row.id as string,
    name:      (row.name as string) ?? "",
    merchant:  (row.merchant as string) ?? "",
    category:  (row.category as string) ?? "Otros",
    amount:    Number(row.amount ?? 0),
    currency:  (row.currency as string) ?? "USD",
    account:   (row.account as string) ?? "personal",
    notes:     (row.notes as string) ?? "",
    tags:      (row.tags as string[]) ?? [],
    icon:      (row.icon as string) ?? "📌",
    createdAt: (row.createdAt as string) ?? "",
  }
}

export function useExpenseTemplates() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["expense-templates", user?.uid],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!user) return [] as ExpenseTemplate[]
      const res = await apiFetch("/api/expense-templates")
      if (!res.ok) throw new Error("Error cargando plantillas de gastos")
      const rows = (await res.json()) as Record<string, unknown>[]
      return rows.map(rowToTemplate)
    },
  })
}

export function useCreateTemplate() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ExpenseTemplateInput) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch("/api/expense-templates", {
        method: "POST",
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error("Error al crear plantilla")
      return res.json() as Promise<{ id: string }>
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["expense-templates", user?.uid] }),
  })
}

export function useDeleteTemplate() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/expense-templates/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar plantilla")
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["expense-templates", user?.uid] }),
  })
}

export function useUpdateTemplate() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<ExpenseTemplateInput> }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/expense-templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error("Error al actualizar plantilla")
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["expense-templates", user?.uid] }),
  })
}
