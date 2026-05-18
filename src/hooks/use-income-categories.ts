"use client"

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  orderBy,
  query,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"

export interface IncomeCategory {
  id: string
  name: string
  emoji: string
  color: string
  createdAt: Timestamp
}

export interface IncomeCategoryInput {
  name: string
  emoji: string
  color: string
}

/** Default built-in categories (shown when user has none yet) */
export const DEFAULT_INCOME_CATEGORIES: Omit<IncomeCategory, "id" | "createdAt">[] = [
  { name: "Nómina",      emoji: "💼", color: "#3b82f6" },
  { name: "Freelance",   emoji: "💻", color: "#8b5cf6" },
  { name: "Inversiones", emoji: "📈", color: "#22c55e" },
  { name: "Alquiler",    emoji: "🏠", color: "#f59e0b" },
  { name: "Venta",       emoji: "🛒", color: "#ec4899" },
  { name: "Bono",        emoji: "🎁", color: "#14b8a6" },
  { name: "Reembolso",   emoji: "↩️",  color: "#64748b" },
  { name: "Otro",        emoji: "📦", color: "#6b7280" },
]

function incomeCatsCol(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "incomeCategories")
}

export function useIncomeCategories() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["income-categories", user?.uid],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user) return [] as IncomeCategory[]
      const q = query(incomeCatsCol(user.uid), orderBy("createdAt", "asc"))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as IncomeCategory)
    },
  })
}

export function useAddIncomeCategory() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: IncomeCategoryInput) => {
      if (!user) throw new Error("No auth")
      await addDoc(incomeCatsCol(user.uid), { ...input, createdAt: Timestamp.now() })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["income-categories", user?.uid] }),
  })
}

export function useUpdateIncomeCategory() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<IncomeCategoryInput> }) => {
      if (!user) throw new Error("No auth")
      await updateDoc(doc(getFirebaseDb(), "users", user.uid, "incomeCategories", id), input)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["income-categories", user?.uid] }),
  })
}

export function useDeleteIncomeCategory() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No auth")
      await deleteDoc(doc(getFirebaseDb(), "users", user.uid, "incomeCategories", id))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["income-categories", user?.uid] }),
  })
}
