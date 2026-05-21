"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "./use-auth"

export interface ReactionEntry {
  emoji: string
  userId: string
}

/** Returns reactions grouped by emoji: Map<emoji, ReactionEntry[]> */
export function useGroupReactions(groupId: string, expenseId: string) {
  const { data } = useQuery({
    queryKey: ["group-reactions", groupId, expenseId],
    enabled: !!groupId && !!expenseId,
    refetchInterval: 5000,
    queryFn: async (): Promise<Map<string, ReactionEntry[]>> => {
      if (!groupId || !expenseId) return new Map()
      const res = await apiFetch(`/api/groups/${groupId}/expenses/${expenseId}/reactions`)
      if (!res.ok) return new Map()
      const grouped = await res.json() as Record<string, string[]>
      const map = new Map<string, ReactionEntry[]>()
      for (const [emoji, userIds] of Object.entries(grouped)) {
        map.set(emoji, userIds.map((userId) => ({ emoji, userId })))
      }
      return map
    },
  })
  return data ?? new Map<string, ReactionEntry[]>()
}

export function useToggleReaction() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      groupId, expenseId, emoji,
    }: { groupId: string; expenseId: string; emoji: string }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/groups/${groupId}/expenses/${expenseId}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      })
      if (!res.ok) throw new Error("Error al actualizar reacción")
    },
    onSuccess: (_d, { groupId, expenseId }) => {
      qc.invalidateQueries({ queryKey: ["group-reactions", groupId, expenseId] })
    },
  })
}
