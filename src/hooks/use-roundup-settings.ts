"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "./use-auth"

export interface RoundupSettings {
  roundupEnabled: boolean
  roundupGoalId: string
}

const DEFAULTS: RoundupSettings = {
  roundupEnabled: false,
  roundupGoalId: "",
}

export function useRoundupSettings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["roundup-settings", user?.uid],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<RoundupSettings> => {
      if (!user) return DEFAULTS
      const res = await apiFetch("/api/settings")
      if (!res.ok) return DEFAULTS
      const data = await res.json() as Record<string, unknown>
      return {
        roundupEnabled: (data.roundupEnabled as boolean) ?? false,
        roundupGoalId:  (data.roundupGoalId  as string)  ?? "",
      }
    },
  })
}

export function useSetRoundupSettings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (updates: Partial<RoundupSettings>) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error("Error al guardar configuración")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roundup-settings", user?.uid] })
    },
  })
}
