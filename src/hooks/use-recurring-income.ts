"use client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"

export interface RecurringIncomeTemplate {
  id: string
  description: string
  source: string
  amount: number
  currency: string
  frequency: "weekly" | "biweekly" | "monthly" | "yearly"
  nextDueDate: string  // "YYYY-MM-DD"
  account: "personal" | "business"
  isActive: boolean
  createdAt: string
}

export interface RecurringIncomeInput {
  description: string
  source: string
  amount: number
  currency: string
  frequency: "weekly" | "biweekly" | "monthly" | "yearly"
  nextDueDate: string  // "YYYY-MM-DD"
  account?: "personal" | "business"
  isActive?: boolean
}

export function useRecurringIncome() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["recurring-income", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      const res = await apiFetch("/api/recurring-income")
      if (!res.ok) throw new Error("Error cargando ingresos recurrentes")
      return res.json() as Promise<RecurringIncomeTemplate[]>
    },
  })
}

export function useAddRecurringIncome() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RecurringIncomeInput) => {
      const res = await apiFetch("/api/recurring-income", { method: "POST", body: JSON.stringify(input) })
      if (!res.ok) throw new Error("Error creando ingreso recurrente")
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring-income", user?.uid] }),
  })
}

export function useUpdateRecurringIncome() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<RecurringIncomeInput> & { id: string }) => {
      const res = await apiFetch(`/api/recurring-income/${id}`, { method: "PATCH", body: JSON.stringify(input) })
      if (!res.ok) throw new Error("Error actualizando")
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring-income", user?.uid] }),
  })
}

export function useDeleteRecurringIncome() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/recurring-income/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error eliminando")
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring-income", user?.uid] }),
  })
}
