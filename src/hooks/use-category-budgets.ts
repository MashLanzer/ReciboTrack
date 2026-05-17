"use client"

import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  setDoc,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"

export interface CategoryBudget {
  id: string
  categoryId: string
  amount: number
  currency: string
  month: string // YYYY-MM
}

export interface CategoryBudgetInput {
  categoryId: string
  amount: number
  currency: string
  month: string // YYYY-MM
}

function categoryBudgetsCollection(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "categoryBudgets")
}

export function useCategoryBudgets(month: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["category-budgets", user?.uid, month],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as CategoryBudget[]
      const col = categoryBudgetsCollection(user.uid)
      const q = query(col, where("month", "==", month))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CategoryBudget)
    },
  })
}

export function useSetCategoryBudget() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CategoryBudgetInput) => {
      if (!user) throw new Error("No autenticado")
      const col = categoryBudgetsCollection(user.uid)
      // Use categoryId + month as the doc ID for natural upsert
      const docId = `${input.categoryId}_${input.month}`
      const ref = doc(col, docId)
      await setDoc(ref, input, { merge: true })
      return docId
    },
    onSuccess: (_id, input) => {
      queryClient.invalidateQueries({ queryKey: ["category-budgets", user?.uid, input.month] })
    },
  })
}

export function useDeleteCategoryBudget() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, month }: { id: string; month: string }) => {
      if (!user) throw new Error("No autenticado")
      await deleteDoc(doc(getFirebaseDb(), "users", user.uid, "categoryBudgets", id))
      return month
    },
    onSuccess: (_result, { month }) => {
      queryClient.invalidateQueries({ queryKey: ["category-budgets", user?.uid, month] })
    },
  })
}
