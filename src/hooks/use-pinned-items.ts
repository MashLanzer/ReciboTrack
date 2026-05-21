"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import type { PinnedItem } from "@/types"
import { apiFetch } from "@/lib/api-client"

const MAX_PINNED = 3

export function usePinnedItems() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["pinnedItems", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as PinnedItem[]
      const res = await apiFetch("/api/pinned-items")
      if (!res.ok) return [] as PinnedItem[]
      return res.json() as Promise<PinnedItem[]>
    },
  })
}

export function usePinItem() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (item: PinnedItem) => {
      if (!user) throw new Error("No autenticado")
      const current = queryClient.getQueryData<PinnedItem[]>(["pinnedItems", user.uid]) ?? []
      if (current.length >= MAX_PINNED) throw new Error("Máximo 3 ítems fijados")
      const next = [...current, item]
      const res = await apiFetch("/api/pinned-items", {
        method: "PATCH",
        body: JSON.stringify({ items: next }),
      })
      if (!res.ok) throw new Error("Error al fijar ítem")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pinnedItems", user?.uid] }),
  })
}

export function useUnpinItem() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (item: PinnedItem) => {
      if (!user) throw new Error("No autenticado")
      const current = queryClient.getQueryData<PinnedItem[]>(["pinnedItems", user.uid]) ?? []
      const next = current.filter((p) => !(p.type === item.type && p.id === item.id))
      const res = await apiFetch("/api/pinned-items", {
        method: "PATCH",
        body: JSON.stringify({ items: next }),
      })
      if (!res.ok) throw new Error("Error al desfijar ítem")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pinnedItems", user?.uid] }),
  })
}
