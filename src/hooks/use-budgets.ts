"use client"

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"
import type { Budget } from "@/types"
import type { BudgetFormInput } from "@/lib/firebase/schemas"

function budgetsCollection(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "budgets")
}

export function useBudgets() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["budgets", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return []
      const snap = await getDocs(budgetsCollection(user.uid))
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Budget)
    },
  })
}

export function useUpsertBudget() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: BudgetFormInput & { id?: string }) => {
      if (!user) throw new Error("No autenticado")
      const col = budgetsCollection(user.uid)
      const { id, ...data } = input

      if (id) {
        await updateDoc(doc(col, id), data)
        return id
      }

      const q = query(col, where("categoryId", "==", input.categoryId))
      const snap = await getDocs(q)
      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, data)
        return snap.docs[0].id
      }

      const ref = await addDoc(col, data)
      return ref.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budgets", user?.uid] }),
  })
}

export function useDeleteBudget() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      await deleteDoc(doc(getFirebaseDb(), "users", user.uid, "budgets", id))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budgets", user?.uid] }),
  })
}
