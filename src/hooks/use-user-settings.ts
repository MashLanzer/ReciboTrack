"use client"

import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"

export interface UserSettings {
  defaultCurrency: string
  defaultPaymentMethod: string | null
  defaultCategory: string
  reminderDaysBefore: number
  compactView: boolean
  weekStartsOn: 0 | 1 // 0 = Sunday, 1 = Monday
  onboardingCompleted: boolean
  accentColor: string           // HSL hue value, e.g. "262" for indigo
  deductibleCategories: string[] // category IDs that are tax-deductible
  autoTheme: boolean             // auto switch dark/light based on time of day
  categoryLimits?: Record<string, number>  // catId → límite mensual en moneda base
  monthlyBudget: number | null   // presupuesto mensual global (null = sin límite)
  monthStartDay: number          // día del mes en que empieza el período (1–28)
  notificationsEnabled: boolean  // push notification master toggle
  notifyRecurring: boolean       // aviso de gastos recurrentes
  notifyWeeklySummary: boolean   // resumen semanal push
  hiddenDefaultCategories: string[] // categorías predeterminadas ocultadas
  // Integraciones
  sheetsLastUrl:      string | null  // URL de la última hoja de cálculo exportada
  sheetsLastSyncedAt: string | null  // ISO timestamp de la última sincronización
  webhookUrl:         string | null  // URL del webhook personal
  webhookEvents:      string[]       // eventos que disparan el webhook: "new_expense" | "budget_alert"
}

const DEFAULTS: UserSettings = {
  defaultCurrency: "USD",
  defaultPaymentMethod: null,
  defaultCategory: "otros",
  reminderDaysBefore: 3,
  compactView: false,
  weekStartsOn: 1,
  onboardingCompleted: false,
  accentColor: "262",            // default indigo
  deductibleCategories: [],
  autoTheme: false,
  categoryLimits: {},
  monthlyBudget: null,
  monthStartDay: 1,
  notificationsEnabled: false,
  notifyRecurring: true,
  notifyWeeklySummary: false,
  hiddenDefaultCategories: [],
  sheetsLastUrl:      null,
  sheetsLastSyncedAt: null,
  webhookUrl:         null,
  webhookEvents:      ["new_expense"],
}

function settingsRef(uid: string) {
  return doc(getFirebaseDb(), "users", uid, "meta", "settings")
}

export function useUserSettings() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["user-settings", user?.uid],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!user) return DEFAULTS
      const snap = await getDoc(settingsRef(user.uid))
      if (!snap.exists()) return DEFAULTS
      return { ...DEFAULTS, ...snap.data() } as UserSettings
    },
  })
}

export function useUpdateUserSettings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: Partial<UserSettings>) => {
      if (!user) throw new Error("No autenticado")
      const ref = settingsRef(user.uid)
      const snap = await getDoc(ref)
      if (snap.exists()) {
        await updateDoc(ref, updates as Record<string, unknown>)
      } else {
        await setDoc(ref, { ...DEFAULTS, ...updates })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-settings", user?.uid] })
    },
  })
}
