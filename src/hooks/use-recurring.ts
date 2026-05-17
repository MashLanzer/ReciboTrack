"use client"

import {
  collection,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  where,
  getDocs,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { addWeeks, addMonths, addYears } from "date-fns"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"
import type { RecurringTemplate, RecurringFrequency } from "@/types"

interface RecurringInput {
  merchant: string
  category: string
  subtotal: number
  tax: number
  total: number
  paymentMethod: string | null
  currency: string
  notes: string
  tags: string[]
  frequency: RecurringFrequency
  nextDueDate: Date
}

function recurringCollection(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "recurring")
}

export function useRecurring() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["recurring", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return []
      const col = recurringCollection(user.uid)
      const q = query(col, where("isActive", "==", true), orderBy("nextDueDate", "asc"))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RecurringTemplate)
    },
  })
}

export function useDueRecurring() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["recurring-due", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return []
      const col = recurringCollection(user.uid)
      const now = Timestamp.now()
      const q = query(
        col,
        where("isActive", "==", true),
        where("nextDueDate", "<=", now),
        orderBy("nextDueDate", "asc")
      )
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RecurringTemplate)
    },
  })
}

export function useAddRecurring() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RecurringInput) => {
      if (!user) throw new Error("No autenticado")
      const col = recurringCollection(user.uid)
      const ref = await addDoc(col, {
        ...input,
        nextDueDate: Timestamp.fromDate(input.nextDueDate),
        isActive: true,
        createdAt: Timestamp.now(),
      })
      return ref.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["recurring-due", user?.uid] })
    },
  })
}

export function useConfirmRecurring() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, frequency }: { id: string; frequency: RecurringFrequency }) => {
      if (!user) throw new Error("No autenticado")
      const now = new Date()
      const nextDue =
        frequency === "weekly"   ? addWeeks(now, 1) :
        frequency === "biweekly" ? addWeeks(now, 2) :
        frequency === "monthly"  ? addMonths(now, 1) :
        addYears(now, 1)

      const ref = doc(getFirebaseDb(), "users", user.uid, "recurring", id)
      await updateDoc(ref, { nextDueDate: Timestamp.fromDate(nextDue) })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["recurring-due", user?.uid] })
    },
  })
}

export function useSnoozeRecurring() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      const snooze = new Date()
      snooze.setDate(snooze.getDate() + 3)
      const ref = doc(getFirebaseDb(), "users", user.uid, "recurring", id)
      await updateDoc(ref, { nextDueDate: Timestamp.fromDate(snooze) })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-due", user?.uid] })
    },
  })
}

export function useUpdateRecurring() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<RecurringInput> }) => {
      if (!user) throw new Error("No autenticado")
      const ref = doc(getFirebaseDb(), "users", user.uid, "recurring", id)
      const data: Record<string, unknown> = { ...input }
      if (input.nextDueDate) data.nextDueDate = Timestamp.fromDate(input.nextDueDate)
      await updateDoc(ref, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["recurring-due", user?.uid] })
    },
  })
}

export function useDeleteRecurring() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      await deleteDoc(doc(getFirebaseDb(), "users", user.uid, "recurring", id))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["recurring-due", user?.uid] })
    },
  })
}
