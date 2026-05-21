"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"

export type AutomationTrigger =
  | "expense_over"
  | "budget_pct"
  | "category_over"
  | "recurring_due"

export type AutomationAction =
  | "webhook"
  | "notification"
  | "tag"

export interface AutomationRule {
  id: string
  uid: string
  name: string
  enabled: boolean
  trigger: AutomationTrigger
  triggerValue: number
  triggerCategory?: string
  action: AutomationAction
  actionValue: string
  lastFiredAt?: Timestamp
  createdAt: Timestamp
}

function rowToAutomation(row: Record<string, unknown>, uid: string): AutomationRule {
  return {
    id:              row.id as string,
    uid,
    name:            row.name as string,
    enabled:         (row.enabled as boolean) ?? true,
    trigger:         row.trigger as AutomationTrigger,
    triggerValue:    Number(row.triggerValue ?? 0),
    triggerCategory: (row.triggerCategory as string) ?? undefined,
    action:          row.action as AutomationAction,
    actionValue:     (row.actionValue as string) ?? "",
    lastFiredAt:     row.lastFiredAt
      ? Timestamp.fromDate(new Date(row.lastFiredAt as string))
      : undefined,
    createdAt: row.createdAt
      ? Timestamp.fromDate(new Date(row.createdAt as string))
      : Timestamp.now(),
  }
}

export function useAutomations() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["automations", user?.uid],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user) return [] as AutomationRule[]
      const res = await apiFetch("/api/automations")
      if (!res.ok) throw new Error("Error cargando automatizaciones")
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map((r) => rowToAutomation(r, user.uid))
    },
  })
}

export function useCreateAutomation() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (rule: Omit<AutomationRule, "id" | "uid" | "createdAt" | "lastFiredAt">) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch("/api/automations", { method: "POST", body: JSON.stringify(rule) })
      if (!res.ok) throw new Error("Error al crear automatización")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automations", user?.uid] }),
  })
}

export function useUpdateAutomation() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<AutomationRule, "id" | "uid" | "createdAt">> }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/automations/${id}`, { method: "PATCH", body: JSON.stringify(updates) })
      if (!res.ok) throw new Error("Error al actualizar automatización")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automations", user?.uid] }),
  })
}

export function useDeleteAutomation() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/automations/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar automatización")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automations", user?.uid] }),
  })
}
