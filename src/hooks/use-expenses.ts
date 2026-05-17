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
  serverTimestamp,
  where,
  getDocs,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { useEffect } from "react"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"
import type { Expense, ExpenseInput } from "@/types"
import { EXPENSES_PER_PAGE } from "@/lib/constants"
import { fireWebhook, buildExpensePayload } from "@/lib/webhook"

function expensesCollection(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "expenses")
}

export type ExpenseSort = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "merchant_asc" | "merchant_desc" | "category_asc"

export function useExpenses(filters?: {
  category?: string
  startDate?: Date
  endDate?: Date
  search?: string
  tags?: string[]
  page?: number
  sort?: ExpenseSort
  account?: "personal" | "business" | "all"
}) {
  const { user } = useAuth()

  const queryClient = useQueryClient()
  const uid = user?.uid

  const result = useQuery({
    queryKey: ["expenses", uid, filters],
    enabled: !!uid,
    placeholderData: keepPreviousData,  // #23 — keep previous page visible while next loads
    staleTime: 60_000,  // #23 — 1 minute stale time to avoid immediate refetch on back-nav
    queryFn: async () => {
      if (!uid) return { expenses: [], total: 0 }

      const col = expensesCollection(uid)
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

      // Account filter (client-side for backwards compatibility with legacy docs)
      if (filters?.account && filters.account !== "all") {
        if (filters.account === "business") {
          expenses = expenses.filter(e => e.account === "business")
        } else {
          // personal: show docs without account field, or account === "personal"
          expenses = expenses.filter(e => !e.account || e.account === "personal")
        }
      }

      if (filters?.search) {
        const s = filters.search.toLowerCase()
        expenses = expenses.filter(
          (e) =>
            e.merchant.toLowerCase().includes(s) ||
            (e.reference?.toLowerCase().includes(s) ?? false) ||
            (e.notes?.toLowerCase().includes(s) ?? false) ||
            (e.project?.toLowerCase().includes(s) ?? false) ||
            (e.tags?.some((t) => t.toLowerCase().includes(s)) ?? false) ||
            (e.items?.some((it) => it.name.toLowerCase().includes(s)) ?? false)
        )
      }

      // Tag filter — applied before pagination so results are always consistent.
      // Comparison is case-insensitive so legacy mixed-case tags still match.
      if (filters?.tags && filters.tags.length > 0) {
        const filterTags = filters.tags.map(t => t.toLowerCase())
        expenses = expenses.filter(e =>
          filterTags.some(ft => e.tags?.some(et => et.toLowerCase() === ft))
        )
      }

      // Collect all unique tags before pagination so the filter dropdown is complete
      const allTags = [...new Set(expenses.flatMap((e) => e.tags ?? []).map(t => t.toLowerCase()))].sort()

      // Sort (Firestore returns date_desc by default; other sorts done client-side)
      const sort = filters?.sort ?? "date_desc"
      if (sort === "date_asc") {
        expenses = [...expenses].reverse()
      } else if (sort === "amount_desc") {
        expenses = [...expenses].sort((a, b) => b.total - a.total)
      } else if (sort === "amount_asc") {
        expenses = [...expenses].sort((a, b) => a.total - b.total)
      } else if (sort === "merchant_asc") {
        expenses = [...expenses].sort((a, b) => a.merchant.localeCompare(b.merchant))
      } else if (sort === "merchant_desc") {
        expenses = [...expenses].sort((a, b) => b.merchant.localeCompare(a.merchant))
      } else if (sort === "category_asc") {
        expenses = [...expenses].sort((a, b) => a.category.localeCompare(b.category))
      }
      // date_desc: already ordered by Firestore

      const total = expenses.length
      const page = filters?.page ?? 1
      const paginated = expenses.slice((page - 1) * EXPENSES_PER_PAGE, page * EXPENSES_PER_PAGE)

      return { expenses: paginated, total, allTags }
    },
  })

  // #23 — Prefetch next page in background when data is available
  const page = filters?.page ?? 1
  const data = result.data
  useEffect(() => {
    if (!uid || !data) return
    const totalPages = Math.ceil(data.total / EXPENSES_PER_PAGE)
    if (page >= totalPages) return
    const nextFilters = { ...filters, page: page + 1 }
    queryClient.prefetchQuery({
      queryKey: ["expenses", uid, nextFilters],
      staleTime: 30_000,
      queryFn: async () => {
        const col = expensesCollection(uid)
        let q = query(col, orderBy("date", "desc"))
        if (nextFilters.category) q = query(q, where("category", "==", nextFilters.category))
        if (nextFilters.startDate) q = query(q, where("date", ">=", Timestamp.fromDate(nextFilters.startDate)))
        if (nextFilters.endDate) q = query(q, where("date", "<=", Timestamp.fromDate(nextFilters.endDate)))
        const snapshot = await getDocs(q)
        let expenses = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)
        if (nextFilters.account && nextFilters.account !== "all") {
          expenses = nextFilters.account === "business"
            ? expenses.filter(e => e.account === "business")
            : expenses.filter(e => !e.account || e.account === "personal")
        }
        if (nextFilters.search) {
          const s = nextFilters.search.toLowerCase()
          expenses = expenses.filter(e =>
            e.merchant.toLowerCase().includes(s) ||
            (e.reference?.toLowerCase().includes(s) ?? false) ||
            (e.notes?.toLowerCase().includes(s) ?? false)
          )
        }
        if (nextFilters.tags && nextFilters.tags.length > 0) {
          const ft = nextFilters.tags.map(t => t.toLowerCase())
          expenses = expenses.filter(e => ft.some(f => e.tags?.some(et => et.toLowerCase() === f)))
        }
        const allTags = [...new Set(expenses.flatMap(e => e.tags ?? []).map(t => t.toLowerCase()))].sort()
        const total = expenses.length
        const paginated = expenses.slice((page) * EXPENSES_PER_PAGE, (page + 1) * EXPENSES_PER_PAGE)
        return { expenses: paginated, total, allTags }
      },
    }).catch(() => {/* ignore prefetch errors */})
  }, [uid, page, data?.total]) // eslint-disable-line react-hooks/exhaustive-deps

  return result
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

/** Fetches ALL expenses in a date range (no pagination). Used for history tables. */
export function useExpensesPeriod(start: Date, end: Date) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["expenses-period", user?.uid, start.toISOString(), end.toISOString()],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as Expense[]
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
      // addDoc resolves immediately when offline (Firebase queues it locally)
      const ref = await addDoc(col, data)
      const expenseId = ref.id

      // Feature A — Link to matching active recurring template
      try {
        const recurringCol = collection(getFirebaseDb(), "users", user.uid, "recurring")
        const recurringSnap = await getDocs(
          query(recurringCol, where("isActive", "==", true))
        )
        const merchantLower = input.merchant.toLowerCase()
        const match = recurringSnap.docs.find(
          (d) => (d.data().merchant as string).toLowerCase() === merchantLower
        )
        if (match) {
          const expenseRef = doc(getFirebaseDb(), "users", user.uid, "expenses", expenseId)
          const templateRef = doc(getFirebaseDb(), "users", user.uid, "recurring", match.id)
          await updateDoc(expenseRef, { recurringId: match.id })
          await updateDoc(templateRef, {
            lastLinkedExpenseId: expenseId,
            lastLinkedAt: serverTimestamp(),
          })
        }
      } catch { /* ignore — linking is best-effort */ }

      return expenseId
    },
    // Optimistic update: insert the new expense into every cached expense list
    // so it appears instantly in the UI even before the server confirms.
    onMutate: async (input) => {
      if (!user) return
      await queryClient.cancelQueries({ queryKey: ["expenses", user.uid] })

      const tempId = `temp_${Date.now()}`
      const optimistic: Expense = {
        id: tempId,
        ...input,
        date: Timestamp.fromDate(input.date),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }

      // Inject into all cached expense-list queries (non-paginated shape)
      queryClient.setQueriesData<{ expenses: Expense[]; total: number; allTags: string[] }>(
        { queryKey: ["expenses", user.uid] },
        (old) => {
          if (!old) return old
          return {
            ...old,
            expenses: [optimistic, ...old.expenses],
            total: old.total + 1,
          }
        }
      )

      return { tempId }
    },
    onSuccess: (id, input, ctx) => {
      // Remove the optimistic entry and refetch real data
      queryClient.invalidateQueries({ queryKey: ["expenses", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["expenses-month", user?.uid] })
      void ctx

      // Fire personal webhook if configured and event is enabled
      try {
        const webhookUrl   = localStorage.getItem("rt-webhook-url")
        const webhookEvents = JSON.parse(localStorage.getItem("rt-webhook-events") ?? "[]") as string[]
        if (webhookUrl && webhookEvents.includes("new_expense")) {
          void fireWebhook(webhookUrl, buildExpensePayload({
            id, ...input, date: { toDate: () => input.date },
          }))
        }
      } catch { /* ignore */ }
    },
    onError: (_err, _input, ctx) => {
      // Roll back the optimistic insert
      if (ctx) {
        queryClient.invalidateQueries({ queryKey: ["expenses", user?.uid] })
      }
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

export function useArchiveExpense() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      const ref = doc(getFirebaseDb(), "users", user.uid, "expenses", id)
      await updateDoc(ref, { archived: true, updatedAt: Timestamp.now() })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["expenses-month", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["expenses-archived", user?.uid] })
    },
  })
}

export function useUnarchiveExpense() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      const ref = doc(getFirebaseDb(), "users", user.uid, "expenses", id)
      await updateDoc(ref, { archived: false, updatedAt: Timestamp.now() })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["expenses-month", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["expenses-archived", user?.uid] })
    },
  })
}

export function useArchivedExpenses() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["expenses-archived", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as Expense[]
      const col = expensesCollection(user.uid)
      const q = query(
        col,
        where("archived", "==", true),
        orderBy("updatedAt", "desc")
      )
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)
    },
  })
}

export function useFlagExpense() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, flagged }: { id: string; flagged: boolean }) => {
      if (!user) throw new Error("No autenticado")
      const ref = doc(getFirebaseDb(), "users", user.uid, "expenses", id)
      if (flagged) {
        await updateDoc(ref, { flagged: true, flaggedAt: Timestamp.now(), updatedAt: Timestamp.now() })
      } else {
        await updateDoc(ref, { flagged: false, flaggedAt: null, updatedAt: Timestamp.now() })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["expenses-period", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["expenses-flagged", user?.uid] })
    },
  })
}

export function useFlaggedExpenses() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["expenses-flagged", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as Expense[]
      const col = expensesCollection(user.uid)
      const q = query(
        col,
        where("flagged", "==", true),
        orderBy("flaggedAt", "desc")
      )
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)
    },
  })
}
