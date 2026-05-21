"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"

export interface WatchlistEntry {
  categoryId: string
  alertThreshold?: number  // monthly spend threshold in user's default currency
}

/** Persists a category watchlist in Supabase (cross-device) */
export function useWatchlist() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["watchlist", user?.uid],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<WatchlistEntry[]> => {
      if (!user) return []
      const res = await apiFetch("/api/watchlist")
      if (!res.ok) return []
      const data = await res.json() as WatchlistEntry[]
      return Array.isArray(data) ? data : []
    },
  })

  async function save(next: WatchlistEntry[]) {
    if (!user) return
    const res = await apiFetch("/api/watchlist", {
      method: "PATCH",
      body: JSON.stringify({ entries: next }),
    })
    if (!res.ok) throw new Error("Error al guardar watchlist")
    queryClient.setQueryData(["watchlist", user.uid], next)
  }

  const addMutation = useMutation({
    mutationFn: async ({ categoryId, alertThreshold }: { categoryId: string; alertThreshold?: number }) => {
      if (entries.some((e) => e.categoryId === categoryId)) return
      await save([...entries, { categoryId, alertThreshold }])
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist", user?.uid] }),
  })

  const removeMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      await save(entries.filter((e) => e.categoryId !== categoryId))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist", user?.uid] }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ categoryId, alertThreshold }: { categoryId: string; alertThreshold: number | undefined }) => {
      await save(entries.map((e) => e.categoryId === categoryId ? { ...e, alertThreshold } : e))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist", user?.uid] }),
  })

  function addToWatchlist(categoryId: string, alertThreshold?: number) {
    addMutation.mutate({ categoryId, alertThreshold })
  }

  function removeFromWatchlist(categoryId: string) {
    removeMutation.mutate(categoryId)
  }

  function updateThreshold(categoryId: string, alertThreshold: number | undefined) {
    updateMutation.mutate({ categoryId, alertThreshold })
  }

  function isWatched(categoryId: string) {
    return entries.some((e) => e.categoryId === categoryId)
  }

  return {
    entries,
    ready: !isLoading,
    addToWatchlist,
    removeFromWatchlist,
    updateThreshold,
    isWatched,
  }
}
