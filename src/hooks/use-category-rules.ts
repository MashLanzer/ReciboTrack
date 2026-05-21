"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import type { CategoryRule, CategoryRuleInput } from "@/types"
import { apiFetch } from "@/lib/api-client"

function rowToRule(row: Record<string, unknown>): CategoryRule {
  return {
    id:         row.id as string,
    name:       (row.name as string) ?? "",
    field:      row.field as CategoryRule["field"],
    operator:   row.operator as CategoryRule["operator"],
    value:      row.value as string,
    categoryId: row.categoryId as string,
    order:      Number(row.order ?? 0),
    enabled:    (row.enabled as boolean) ?? true,
    createdAt:  row.createdAt ? Timestamp.fromDate(new Date(row.createdAt as string)) : Timestamp.now(),
  }
}

export function useCategoryRules() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["categoryRules", user?.uid],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!user) return [] as CategoryRule[]
      const res = await apiFetch("/api/category-rules")
      if (!res.ok) throw new Error("Error cargando reglas")
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToRule)
    },
  })
}

export function useAddCategoryRule() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CategoryRuleInput) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch("/api/category-rules", { method: "POST", body: JSON.stringify(input) })
      if (!res.ok) throw new Error("Error al crear regla")
      const json = await res.json() as { id: string }
      return json.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categoryRules", user?.uid] }),
  })
}

export function useUpdateCategoryRule() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<CategoryRuleInput> }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/category-rules/${id}`, { method: "PATCH", body: JSON.stringify(input) })
      if (!res.ok) throw new Error("Error al actualizar regla")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categoryRules", user?.uid] }),
  })
}

export function useDeleteCategoryRule() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/category-rules/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar regla")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categoryRules", user?.uid] }),
  })
}

// ─── Rule engine — aplicar reglas a un candidato de gasto ────────────────────
export function applyRules(
  rules: CategoryRule[],
  candidate: { merchant: string; amount: number; notes?: string }
): string | null {
  const active = rules.filter((r) => r.enabled).sort((a, b) => a.order - b.order)

  for (const rule of active) {
    let fieldValue: string

    if (rule.field === "merchant") {
      fieldValue = candidate.merchant.toLowerCase()
    } else if (rule.field === "notes") {
      fieldValue = (candidate.notes ?? "").toLowerCase()
    } else if (rule.field === "amount_min") {
      const threshold = parseFloat(rule.value)
      if (!isNaN(threshold) && candidate.amount >= threshold) return rule.categoryId
      continue
    } else if (rule.field === "amount_max") {
      const threshold = parseFloat(rule.value)
      if (!isNaN(threshold) && candidate.amount <= threshold) return rule.categoryId
      continue
    } else {
      continue
    }

    const val = rule.value.toLowerCase()
    if (rule.operator === "contains"    && fieldValue.includes(val))    return rule.categoryId
    if (rule.operator === "starts_with" && fieldValue.startsWith(val))  return rule.categoryId
    if (rule.operator === "equals"      && fieldValue === val)           return rule.categoryId
  }

  return null
}
