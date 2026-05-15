"use client"

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  increment,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"

export interface ExpenseTemplate {
  id: string
  name: string           // user-facing label, e.g. "Café del trabajo"
  merchant: string
  category: string
  total: number
  subtotal: number
  tax: number
  paymentMethod: string | null
  currency: string
  notes: string
  tags: string[]
  useCount: number
  lastUsed: Timestamp | null
  createdAt: Timestamp
}

export type TemplateInput = Omit<ExpenseTemplate, "id" | "useCount" | "lastUsed" | "createdAt">

function templatesCol(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "templates")
}

export function useTemplates() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["templates", user?.uid],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!user) return []
      const q = query(templatesCol(user.uid), orderBy("useCount", "desc"))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ExpenseTemplate)
    },
  })
}

export function useAddTemplate() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: TemplateInput) => {
      if (!user) throw new Error("No autenticado")
      const now = Timestamp.now()
      await addDoc(templatesCol(user.uid), {
        ...input,
        useCount: 0,
        lastUsed: null,
        createdAt: now,
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates", user?.uid] }),
  })
}

export function useDeleteTemplate() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      await deleteDoc(doc(getFirebaseDb(), "users", user.uid, "templates", id))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates", user?.uid] }),
  })
}

export function useIncrementTemplateUse() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      await updateDoc(doc(getFirebaseDb(), "users", user.uid, "templates", id), {
        useCount: increment(1),
        lastUsed: Timestamp.now(),
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates", user?.uid] }),
  })
}

export function useUpdateTemplate() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<TemplateInput> }) => {
      if (!user) throw new Error("No autenticado")
      await updateDoc(doc(getFirebaseDb(), "users", user.uid, "templates", id), input as Record<string, unknown>)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates", user?.uid] }),
  })
}
