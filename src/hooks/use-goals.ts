"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"

export type GoalType = "saving" | "daily_limit"

export interface Goal {
  id: string
  type: GoalType
  name: string
  /** For saving goals: target amount to save. For daily_limit: max spend per day */
  targetAmount: number
  /** For saving goals: current saved amount (manually updated) */
  currentAmount: number
  currency: string
  /** Optional deadline (ISO string) */
  deadline: string | null
  isActive: boolean
  createdAt: Timestamp
}

export interface GoalInput {
  type: GoalType
  name: string
  targetAmount: number
  currentAmount: number
  currency: string
  deadline: string | null
}

function rowToGoal(row: Record<string, unknown>): Goal {
  return {
    id:            row.id as string,
    type:          (row.type as GoalType) ?? "saving",
    name:          row.name as string,
    targetAmount:  Number(row.targetAmount),
    currentAmount: Number(row.currentAmount),
    currency:      (row.currency as string) ?? "USD",
    deadline:      (row.deadline as string) ?? null,
    isActive:      (row.isActive as boolean) ?? true,
    createdAt:     row.createdAt
      ? Timestamp.fromDate(new Date(row.createdAt as string))
      : Timestamp.now(),
  }
}

export function useGoals() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["goals", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as Goal[]
      const res = await apiFetch("/api/goals")
      if (!res.ok) throw new Error("Error cargando metas")
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToGoal)
    },
  })
}

export function useAddGoal() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: GoalInput) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch("/api/goals", {
        method: "POST",
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error("Error al crear meta")
      const json = await res.json() as { id: string }
      return json.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals", user?.uid] }),
  })
}

export function useUpdateGoalProgress() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, currentAmount }: { id: string; currentAmount: number }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/goals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ currentAmount }),
      })
      if (!res.ok) throw new Error("Error al actualizar progreso")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals", user?.uid] }),
  })
}

export function useDeleteGoal() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/goals/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar meta")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals", user?.uid] }),
  })
}

export function useUpdateGoal() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Goal> & { id: string }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/goals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error("Error al actualizar meta")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals", user?.uid] }),
  })
}
