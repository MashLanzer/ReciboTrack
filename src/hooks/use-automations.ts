"use client"

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"

export type AutomationTrigger =
  | "expense_over"       // total > threshold
  | "budget_pct"         // monthly budget % exceeded
  | "category_over"      // category total > threshold
  | "recurring_due"      // recurring payment due in N days

export type AutomationAction =
  | "webhook"            // POST to URL
  | "notification"       // in-app push notification
  | "tag"                // auto-tag the expense

export interface AutomationRule {
  id: string
  uid: string
  name: string
  enabled: boolean
  trigger: AutomationTrigger
  triggerValue: number       // threshold / pct / days
  triggerCategory?: string   // for category_over
  action: AutomationAction
  actionValue: string        // webhook URL / tag name / notification message
  lastFiredAt?: Timestamp
  createdAt: Timestamp
}

function automationsCol(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "automations")
}

export function useAutomations() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["automations", user?.uid],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user) return []
      const q = query(automationsCol(user.uid), orderBy("createdAt", "desc"))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, uid: user.uid, ...d.data() }) as AutomationRule)
    },
  })
}

export function useCreateAutomation() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      rule: Omit<AutomationRule, "id" | "uid" | "createdAt" | "lastFiredAt">
    ) => {
      if (!user) throw new Error("No autenticado")
      await addDoc(automationsCol(user.uid), {
        ...rule,
        uid: user.uid,
        createdAt: Timestamp.now(),
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automations", user?.uid] }),
  })
}

export function useUpdateAutomation() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<Omit<AutomationRule, "id" | "uid" | "createdAt">>
    }) => {
      if (!user) throw new Error("No autenticado")
      await updateDoc(doc(getFirebaseDb(), "users", user.uid, "automations", id), updates)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automations", user?.uid] }),
  })
}

export function useDeleteAutomation() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      await deleteDoc(doc(getFirebaseDb(), "users", user.uid, "automations", id))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automations", user?.uid] }),
  })
}
