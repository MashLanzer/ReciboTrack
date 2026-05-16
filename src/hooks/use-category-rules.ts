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
import type { CategoryRule, CategoryRuleInput, ExpenseInput } from "@/types"

function rulesCol(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "categoryRules")
}

// ─── CRUD hooks ───────────────────────────────────────────────────────────────

export function useCategoryRules() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["categoryRules", user?.uid],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!user) return []
      const q = query(rulesCol(user.uid), orderBy("order", "asc"))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CategoryRule)
    },
  })
}

export function useAddCategoryRule() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CategoryRuleInput) => {
      if (!user) throw new Error("No autenticado")
      const ref = await addDoc(rulesCol(user.uid), { ...input, createdAt: Timestamp.now() })
      return ref.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categoryRules", user?.uid] }),
  })
}

export function useUpdateCategoryRule() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<CategoryRuleInput> }) => {
      if (!user) throw new Error("No autenticado")
      await updateDoc(doc(getFirebaseDb(), "users", user.uid, "categoryRules", id), input as Record<string, unknown>)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categoryRules", user?.uid] }),
  })
}

export function useDeleteCategoryRule() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      await deleteDoc(doc(getFirebaseDb(), "users", user.uid, "categoryRules", id))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categoryRules", user?.uid] }),
  })
}

// ─── Rule engine — apply rules to an expense candidate ───────────────────────

export function applyRules(
  rules: CategoryRule[],
  candidate: { merchant: string; amount: number; notes?: string }
): string | null {
  const active = rules.filter((r) => r.enabled).sort((a, b) => a.order - b.order)

  for (const rule of active) {
    let fieldValue: string

    if (rule.field === "merchant") {
      fieldValue = candidate.merchant.toLowerCase()
    } else if (rule.field === "notes") {
      fieldValue = (candidate.notes ?? "").toLowerCase()
    } else if (rule.field === "amount_min") {
      const threshold = parseFloat(rule.value)
      if (!isNaN(threshold) && candidate.amount >= threshold) return rule.categoryId
      continue
    } else if (rule.field === "amount_max") {
      const threshold = parseFloat(rule.value)
      if (!isNaN(threshold) && candidate.amount <= threshold) return rule.categoryId
      continue
    } else {
      continue
    }

    const val = rule.value.toLowerCase()

    if (rule.operator === "contains" && fieldValue.includes(val)) return rule.categoryId
    if (rule.operator === "starts_with" && fieldValue.startsWith(val)) return rule.categoryId
    if (rule.operator === "equals" && fieldValue === val) return rule.categoryId
  }

  return null
}
