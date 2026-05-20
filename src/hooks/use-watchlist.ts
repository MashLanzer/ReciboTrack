"use client"

import { doc, getDoc, setDoc } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"

export interface WatchlistEntry {
  categoryId: string
  alertThreshold?: number  // monthly spend threshold in user's default currency
}

const STORAGE_KEY = "rt-category-watchlist"   // legacy key for migration only

function watchlistRef(uid: string) {
  return doc(getFirebaseDb(), "users", uid, "meta", "watchlist")
}

/** Persists a category watchlist in Firestore (cross-device) */
export function useWatchlist() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["watchlist", user?.uid],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<WatchlistEntry[]> => {
      if (!user) return []
      const ref = watchlistRef(user.uid)
      const snap = await getDoc(ref)

      if (snap.exists()) {
        const data = snap.data()
        return Array.isArray(data.entries) ? (data.entries as WatchlistEntry[]) : []
      }

      // ── Migrate from localStorage on first Firestore read ────────────────
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as WatchlistEntry[]
          if (Array.isArray(parsed) && parsed.length > 0) {
            await setDoc(ref, { entries: parsed })
            localStorage.removeItem(STORAGE_KEY)
            return parsed
          }
        }
      } catch { /* ignore */ }

      return []
    },
  })

  async function save(next: WatchlistEntry[]) {
    if (!user) return
    await setDoc(watchlistRef(user.uid), { entries: next })
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
