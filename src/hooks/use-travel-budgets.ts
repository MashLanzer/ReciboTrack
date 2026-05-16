"use client"

import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, Timestamp, orderBy, query,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"
import type { TravelBudget } from "@/types"

export interface TravelBudgetInput {
  name: string
  emoji: string
  totalLimit: number
  currency: string
  startDate: Date
  endDate: Date
  tags: string[]
}

function col(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "travelBudgets")
}

export function useTravelBudgets() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["travelBudgets", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return []
      const q = query(col(user.uid), orderBy("startDate", "desc"))
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as TravelBudget)
    },
  })
}

export function useAddTravelBudget() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: TravelBudgetInput) => {
      if (!user) throw new Error("No autenticado")
      await addDoc(col(user.uid), {
        ...input,
        startDate: Timestamp.fromDate(input.startDate),
        endDate:   Timestamp.fromDate(input.endDate),
        createdAt: Timestamp.now(),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["travelBudgets", user?.uid] }),
  })
}

export function useDeleteTravelBudget() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      await deleteDoc(doc(getFirebaseDb(), "users", user.uid, "travelBudgets", id))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["travelBudgets", user?.uid] }),
  })
}
