"use client"

import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"

export type GoalType = "saving" | "daily_limit"

export interface Goal {
  id: string
  type: GoalType
  name: string
  /** For saving goals: target amount to save. For daily_limit: max spend per day */
  targetAmount: number
  /** For saving goals: current saved amount (manually updated) */
  currentAmount: number
  currency: string
  /** Optional deadline (ISO string) */
  deadline: string | null
  isActive: boolean
  createdAt: Timestamp
}

export interface GoalInput {
  type: GoalType
  name: string
  targetAmount: number
  currentAmount: number
  currency: string
  deadline: string | null
}

function goalsCollection(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "goals")
}

export function useGoals() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["goals", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return []
      const snap = await getDocs(goalsCollection(user.uid))
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Goal)
    },
  })
}

export function useAddGoal() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: GoalInput) => {
      if (!user) throw new Error("No autenticado")
      const ref = await addDoc(goalsCollection(user.uid), {
        ...input,
        isActive: true,
        createdAt: Timestamp.now(),
      })
      return ref.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals", user?.uid] }),
  })
}

export function useUpdateGoalProgress() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, currentAmount }: { id: string; currentAmount: number }) => {
      if (!user) throw new Error("No autenticado")
      await updateDoc(doc(getFirebaseDb(), "users", user.uid, "goals", id), { currentAmount })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals", user?.uid] }),
  })
}

export function useDeleteGoal() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      await deleteDoc(doc(getFirebaseDb(), "users", user.uid, "goals", id))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals", user?.uid] }),
  })
}

export function useUpdateGoal() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Goal> & { id: string }) => {
      if (!user) throw new Error("No autenticado")
      await updateDoc(doc(getFirebaseDb(), "users", user.uid, "goals", id), updates)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals", user?.uid] }),
  })
}
