"use client"

import { useQuery } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"
import type { ACHIEVEMENTS } from "@/lib/achievements"

export interface AchievementEntry {
  id: string
  earnedAt: string
}

export interface AchievementFull {
  id: string
  label: string
  emoji: string
  description: string
  earned: boolean
  earnedAt: string | null
}

export interface AchievementsData {
  earned: AchievementEntry[]
  all: AchievementFull[]
  streak: { current: number; longest: number }
}

export function useAchievements() {
  const { user } = useAuth()

  return useQuery<AchievementsData>({
    queryKey: ["achievements"],
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      const res = await apiFetch("/api/achievements")
      if (!res.ok) throw new Error("Error cargando logros")
      return res.json() as Promise<AchievementsData>
    },
  })
}
