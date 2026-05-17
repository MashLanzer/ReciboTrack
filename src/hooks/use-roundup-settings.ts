"use client"

import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"

export interface RoundupSettings {
  roundupEnabled: boolean
  roundupGoalId: string
}

const DEFAULTS: RoundupSettings = {
  roundupEnabled: false,
  roundupGoalId: "",
}

function settingsRef(uid: string) {
  return doc(getFirebaseDb(), "users", uid, "meta", "settings")
}

export function useRoundupSettings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["roundup-settings", user?.uid],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<RoundupSettings> => {
      if (!user) return DEFAULTS
      const snap = await getDoc(settingsRef(user.uid))
      if (!snap.exists()) return DEFAULTS
      const data = snap.data() as Record<string, unknown>
      return {
        roundupEnabled: (data.roundupEnabled as boolean) ?? false,
        roundupGoalId: (data.roundupGoalId as string) ?? "",
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
      const ref = settingsRef(user.uid)
      const snap = await getDoc(ref)
      if (snap.exists()) {
        await updateDoc(ref, updates as Record<string, unknown>)
      } else {
        await setDoc(ref, { ...DEFAULTS, ...updates })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roundup-settings", user?.uid] })
    },
  })
}
