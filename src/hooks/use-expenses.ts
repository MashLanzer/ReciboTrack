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
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"
import type { Expense, ExpenseInput } from "@/types"
import { EXPENSES_PER_PAGE } from "@/lib/constants"

function expensesCollection(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "expenses")
}

export type ExpenseSort = "date_desc" | "date_asc" | "amount_desc" | "amount_asc"

export function useExpenses(filters?: {
  category?: string
  startDate?: Date
  endDate?: Date
  search?: string
  page?: number
  sort?: ExpenseSort
}) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["expenses", user?.uid, filters],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return { expenses: [], total: 0 }

      const col = expensesCollection(user.uid)
      let q = query(col, orderBy("date", "desc"))

      if (filters?.category) {
        q = query(q, where("category", "==", filters.category))
      }
      if (filters?.startDate) {
        q = query(q, where("date", ">=", Timestamp.fromDate(filters.startDate)))
      }
      if (filters?.endDate) {
        q = query(q, where("date", "<=", Timestamp.fromDate(filters.endDate)))
      }

      const snapshot = await getDocs(q)
      let expenses = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)

      if (filters?.search) {
        const s = filters.search.toLowerCase()
        expenses = expenses.filter(
          (e) =>
            e.merchant.toLowerCase().includes(s) ||
            (e.reference?.toLowerCase().includes(s) ?? false) ||
            (e.notes?.toLowerCase().includes(s) ?? false) ||
            (e.tags?.some((t) => t.toLowerCase().includes(s)) ?? false) ||
            (e.items?.some((it) => it.name.toLowerCase().includes(s)) ?? false)
        )
      }

      // Collect all unique tags before pagination so the filter dropdown is complete
      const allTags = [...new Set(expenses.flatMap((e) => e.tags ?? []))].sort()

      // Sort (Firestore returns date_desc by default; other sorts done client-side)
      const sort = filters?.sort ?? "date_desc"
      if (sort === "date_asc") {
        expenses = [...expenses].reverse()
      } else if (sort === "amount_desc") {
        expenses = [...expenses].sort((a, b) => b.total - a.total)
      } else if (sort === "amount_asc") {
        expenses = [...expenses].sort((a, b) => a.total - b.total)
      }
      // date_desc: already ordered by Firestore

      const total = expenses.length
      const page = filters?.page ?? 1
      const paginated = expenses.slice((page - 1) * EXPENSES_PER_PAGE, page * EXPENSES_PER_PAGE)

      return { expenses: paginated, total, allTags }
    },
  })
}

export function useExpensesForMonth(year: number, month: number) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["expenses-month", user?.uid, year, month],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return []
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 0, 23, 59, 59)
      const col = expensesCollection(user.uid)
      const q = query(
        col,
        where("date", ">=", Timestamp.fromDate(start)),
        where("date", "<=", Timestamp.fromDate(end)),
        orderBy("date", "desc")
      )
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)
    },
  })
}

export function useAddExpense() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: ExpenseInput) => {
      if (!user) throw new Error("No autenticado")
      const col = expensesCollection(user.uid)
      const now = Timestamp.now()
      const data = {
        ...input,
        date: Timestamp.fromDate(input.date),
        createdAt: now,
        updatedAt: now,
      }
      const ref = await addDoc(col, data)
      return ref.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["expenses-month", user?.uid] })
    },
  })
}

export function useUpdateExpense() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<ExpenseInput> }) => {
      if (!user) throw new Error("No autenticado")
      const ref = doc(getFirebaseDb(), "users", user.uid, "expenses", id)
      const data: Record<string, unknown> = { ...input, updatedAt: Timestamp.now() }
      if (input.date) data.date = Timestamp.fromDate(input.date)
      await updateDoc(ref, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["expenses-month", user?.uid] })
    },
  })
}

export function useDeleteExpense() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      await deleteDoc(doc(getFirebaseDb(), "users", user.uid, "expenses", id))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["expenses-month", user?.uid] })
    },
  })
}
