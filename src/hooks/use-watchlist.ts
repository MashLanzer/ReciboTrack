"use client"

import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "rt-category-watchlist"

export interface WatchlistEntry {
  categoryId: string
  alertThreshold?: number  // monthly spend threshold in user's default currency
}

/** Persists a category watchlist in localStorage */
export function useWatchlist() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([])
  const [ready, setReady] = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setEntries(parsed)
      }
    } catch {
      // ignore parse errors
    } finally {
      setReady(true)
    }
  }, [])

  // Persist to localStorage whenever entries change (after hydration)
  useEffect(() => {
    if (!ready) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }, [entries, ready])

  const addToWatchlist = useCallback((categoryId: string, alertThreshold?: number) => {
    setEntries((prev) => {
      if (prev.some((e) => e.categoryId === categoryId)) return prev
      return [...prev, { categoryId, alertThreshold }]
    })
  }, [])

  const removeFromWatchlist = useCallback((categoryId: string) => {
    setEntries((prev) => prev.filter((e) => e.categoryId !== categoryId))
  }, [])

  const updateThreshold = useCallback((categoryId: string, alertThreshold: number | undefined) => {
    setEntries((prev) =>
      prev.map((e) => (e.categoryId === categoryId ? { ...e, alertThreshold } : e))
    )
  }, [])

  const isWatched = useCallback((categoryId: string) => {
    return entries.some((e) => e.categoryId === categoryId)
  }, [entries])

  return {
    entries,
    ready,
    addToWatchlist,
    removeFromWatchlist,
    updateThreshold,
    isWatched,
  }
}
