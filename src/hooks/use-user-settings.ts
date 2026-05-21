"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"

export interface UserSettings {
  defaultCurrency: string
  defaultPaymentMethod: string | null
  defaultCategory: string
  reminderDaysBefore: number
  compactView: boolean
  weekStartsOn: 0 | 1
  onboardingCompleted: boolean
  accentColor: string
  deductibleCategories: string[]
  autoTheme: boolean
  categoryLimits?: Record<string, number>
  monthlyBudget: number | null
  monthStartDay: number
  notificationsEnabled: boolean
  notifyRecurring: boolean
  notifyWeeklySummary: boolean
  hiddenDefaultCategories: string[]
  sheetsLastUrl:      string | null
  sheetsLastSyncedAt: string | null
  handle:             string | null
  hasExportedPDF:     boolean
}

const DEFAULTS: UserSettings = {
  defaultCurrency:         "USD",
  defaultPaymentMethod:    null,
  defaultCategory:         "otros",
  reminderDaysBefore:      3,
  compactView:             false,
  weekStartsOn:            1,
  onboardingCompleted:     false,
  accentColor:             "262",
  deductibleCategories:    [],
  autoTheme:               false,
  categoryLimits:          {},
  monthlyBudget:           null,
  monthStartDay:           1,
  notificationsEnabled:    false,
  notifyRecurring:         true,
  notifyWeeklySummary:     false,
  hiddenDefaultCategories: [],
  sheetsLastUrl:           null,
  sheetsLastSyncedAt:      null,
  handle:                  null,
  hasExportedPDF:          false,
}

export function useUserSettings() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["user-settings", user?.uid],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!user) return DEFAULTS
      const res = await apiFetch("/api/settings")
      if (!res.ok) return DEFAULTS
      const data = await res.json() as Partial<UserSettings>
      return { ...DEFAULTS, ...data } as UserSettings
    },
  })
}

export function useUpdateUserSettings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: Partial<UserSettings>) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error("Error al guardar configuración")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-settings", user?.uid] })
    },
  })
}
