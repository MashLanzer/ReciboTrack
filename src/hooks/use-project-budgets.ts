"use client"

import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"

/** Maps project name → budget limit (in user's default currency) */
export type ProjectBudgets = Record<string, number>

function budgetsDocRef(uid: string) {
  return doc(getFirebaseDb(), "users", uid, "settings", "projectBudgets")
}

export function useProjectBudgets() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["project-budgets", user?.uid],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user) return {} as ProjectBudgets
      const snap = await getDoc(budgetsDocRef(user.uid))
      return (snap.exists() ? snap.data() : {}) as ProjectBudgets
    },
  })
}

export function useSetProjectBudget() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      projectName,
      budget,
    }: {
      projectName: string
      budget: number | null
    }) => {
      if (!user) throw new Error("No autenticado")
      const ref = budgetsDocRef(user.uid)
      const snap = await getDoc(ref)
      const current = (snap.exists() ? snap.data() : {}) as ProjectBudgets
      if (budget === null) {
        delete current[projectName]
      } else {
        current[projectName] = budget
      }
      await setDoc(ref, current)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["project-budgets", user?.uid] }),
  })
}
