"use client"

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"
import type { QuickExpense, QuickExpenseInput } from "@/types"

function quickExpensesCol(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "quickExpenses")
}

export function useQuickExpenses() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["quickExpenses", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return []
      const q = query(quickExpensesCol(user.uid), orderBy("order", "asc"))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as QuickExpense)
    },
  })
}

export function useAddQuickExpense() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: QuickExpenseInput) => {
      if (!user) throw new Error("No autenticado")
      const ref = await addDoc(quickExpensesCol(user.uid), {
        ...input,
        createdAt: Timestamp.now(),
      })
      return ref.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quickExpenses", user?.uid] }),
  })
}

export function useUpdateQuickExpense() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<QuickExpenseInput> }) => {
      if (!user) throw new Error("No autenticado")
      await updateDoc(doc(getFirebaseDb(), "users", user.uid, "quickExpenses", id), input)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quickExpenses", user?.uid] }),
  })
}

export function useDeleteQuickExpense() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      await deleteDoc(doc(getFirebaseDb(), "users", user.uid, "quickExpenses", id))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quickExpenses", user?.uid] }),
  })
}
