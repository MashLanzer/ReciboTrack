"use client"

import {
  collection,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
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
import { toast } from "sonner"
import { stripUndefined } from "@/lib/utils"
import { format } from "date-fns"
import type { CategoryBudget } from "./use-category-budgets"

function expensesCollection(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "expenses")
}

export type ExpenseSort = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "merchant_asc" | "merchant_desc" | "category_asc"

export type ExpenseFilters = {
  category?: string
  startDate?: Date
  endDate?: Date
  search?: string
  tags?: string[]
  page?: number
  sort?: ExpenseSort
  account?: "personal" | "business" | "all"
}

async function fetchExpenses(
  uid: string,
  filters: ExpenseFilters | undefined,
  page: number
): Promise<{ expenses: Expense[]; total: number; allTags: string[] }> {
  const col = expensesCollection(uid)
  let q = query(col, orderBy("date", "desc"))
  if (filters?.category) q = query(q, where("category", "==", filters.category))
  if (filters?.startDate) q = query(q, where("date", ">=", Timestamp.fromDate(filters.startDate)))
  if (filters?.endDate) q = query(q, where("date", "<=", Timestamp.fromDate(filters.endDate)))
  const snapshot = await getDocs(q)
  let expenses = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)
  // account filter
  if (filters?.account && filters.account !== "all") {
    expenses = filters.account === "business"
      ? expenses.filter(e => e.account === "business")
      : expenses.filter(e => !e.account || e.account === "personal")
  }
  // search filter
  if (filters?.search) {
    const s = filters.search.toLowerCase()
    expenses = expenses.filter(e =>
      e.merchant.toLowerCase().includes(s) ||
      (e.reference?.toLowerCase().includes(s) ?? false) ||
      (e.notes?.toLowerCase().includes(s) ?? false) ||
      (e.project?.toLowerCase().includes(s) ?? false) ||
      (e.tags?.some((t) => t.toLowerCase().includes(s)) ?? false) ||
      (e.items?.some((it) => it.name.toLowerCase().includes(s)) ?? false)
    )
  }
  // tag filter
  if (filters?.tags && filters.tags.length > 0) {
    const ft = filters.tags.map(t => t.toLowerCase())
    expenses = expenses.filter(e => ft.some(f => e.tags?.some(et => et.toLowerCase() === f)))
  }
  const allTags = [...new Set(expenses.flatMap(e => e.tags ?? []).map(t => t.toLowerCase()))].sort()
  // sort
  const sort = filters?.sort ?? "date_desc"
  if (sort === "date_asc") expenses = [...expenses].reverse()
  else if (sort === "amount_desc") expenses = [...expenses].sort((a, b) => b.total - a.total)
  else if (sort === "amount_asc") expenses = [...expenses].sort((a, b) => a.total - b.total)
  else if (sort === "merchant_asc") expenses = [...expenses].sort((a, b) => a.merchant.localeCompare(b.merchant))
  else if (sort === "merchant_desc") expenses = [...expenses].sort((a, b) => b.merchant.localeCompare(a.merchant))
  else if (sort === "category_asc") expenses = [...expenses].sort((a, b) => a.category.localeCompare(b.category))
  const total = expenses.length
  const paginated = expenses.slice((page - 1) * EXPENSES_PER_PAGE, page * EXPENSES_PER_PAGE)
  return { expenses: paginated, total, allTags }
}

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
      if (!uid) return { expenses: [], total: 0, allTags: [] as string[] }
      return fetchExpenses(uid, filters, filters?.page ?? 1)
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
      queryFn: () => fetchExpenses(uid, nextFilters, page + 1),
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
      // stripUndefined — Firestore rejects `undefined` (optional fields: account, project, privacy…)
      const data = stripUndefined({
        ...input,
        date: Timestamp.fromDate(input.date),
        createdAt: now,
        updatedAt: now,
      }) as Record<string, unknown>
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
    onSuccess: async (id, input, ctx) => {
      // Remove the optimistic entry and refetch real data
      queryClient.invalidateQueries({ queryKey: ["expenses", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["expenses-month", user?.uid] })
      void ctx

      // Fire personal webhook if configured and event is enabled
      if (user?.uid) {
        try {
          const userSnap = await getDoc(doc(getFirebaseDb(), "users", user.uid))
          const userData = userSnap.data() ?? {}
          const webhookUrl    = typeof userData.webhookUrl === "string" ? userData.webhookUrl : ""
          const webhookEvents = Array.isArray(userData.webhookEvents) ? userData.webhookEvents as string[] : []
          if (webhookUrl && webhookEvents.includes("new_expense")) {
            void fireWebhook(webhookUrl, buildExpensePayload({
              id, ...input, date: { toDate: () => input.date },
            }))
          }
        } catch { /* ignore */ }
      }

      // ── Feature 2: Budget alert ─────────────────────────────────────────
      // Only for personal expenses (not group expenses)
      if (!user || (input as { groupId?: string }).groupId) return
      try {
        const currentMonth = format(new Date(), "yyyy-MM")
        const budgetsCol = collection(getFirebaseDb(), "users", user.uid, "categoryBudgets")
        const budgetsSnap = await getDocs(query(budgetsCol, where("month", "==", currentMonth)))
        const budgets = budgetsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as CategoryBudget)
        const matchingBudget = budgets.find((b) => b.categoryId === input.category)
        if (!matchingBudget) return

        // Use the React Query cache for all expenses — filter client-side
        const allCached = queryClient.getQueriesData<{ expenses: Expense[]; total: number; allTags: string[] }>({
          queryKey: ["expenses", user.uid],
        })
        // Gather all cached expenses across all query keys
        const cachedExpenses: Expense[] = []
        for (const [, data] of allCached) {
          if (data?.expenses) cachedExpenses.push(...data.expenses)
        }

        // Deduplicate by id
        const seenIds = new Set<string>()
        const uniqueExpenses = cachedExpenses.filter((e) => {
          if (seenIds.has(e.id)) return false
          seenIds.add(e.id)
          return true
        })

        // Filter: same category, current month
        const startOfCurrentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        const catExpenses = uniqueExpenses.filter((e) => {
          if (e.category !== input.category) return false
          const d = e.date instanceof Timestamp ? e.date.toDate() : new Date(e.date as unknown as string)
          return d >= startOfCurrentMonth
        })

        const totalSpent = catExpenses.reduce((sum, e) => sum + e.total, 0)
        const budget = matchingBudget.amount
        const pct = Math.round((totalSpent / budget) * 100)

        const formatAmt = (n: number) =>
          new Intl.NumberFormat("es", { style: "currency", currency: matchingBudget.currency || "USD", maximumFractionDigits: 0 }).format(n)

        if (totalSpent >= budget) {
          toast.error("Presupuesto superado", {
            description: `Categoría: ${input.category} · ${formatAmt(totalSpent)} de ${formatAmt(budget)} gastado (${pct}%)`,
            duration: 8000,
            action: {
              label: "Ver presupuestos",
              onClick: () => { window.location.href = "/budgets" },
            },
          })
        } else if (totalSpent >= budget * 0.8) {
          toast.warning(`Presupuesto al ${pct}%`, {
            description: `Categoría: ${input.category} · ${formatAmt(totalSpent)} de ${formatAmt(budget)} gastado`,
            duration: 8000,
            action: {
              label: "Ver presupuestos",
              onClick: () => { window.location.href = "/budgets" },
            },
          })
        }
      } catch { /* ignore — budget check is best-effort */ }

      // ── Feature 4: "¿Es esto recurrente?" hint ──────────────────────────────
      // Show a toast when the merchant looks like a regular subscription pattern
      // but is NOT yet tracked in recurring templates.
      try {
        const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ")
        const merchantKey = normalize(input.merchant)

        // Check if already tracked
        const recurringCached = queryClient.getQueryData<{ merchant: string }[]>(["recurring", user.uid])
        const isAlreadyTracked = (recurringCached ?? []).some(
          (t) => normalize(t.merchant) === merchantKey
        )
        if (isAlreadyTracked) return

        // Use the detector cache (expenses from last 300 ordered by date desc)
        const detectorData = queryClient.getQueryData<Expense[]>(["expenses-detector", user.uid])
        if (!detectorData || detectorData.length < 3) return

        const merchantExpenses = detectorData.filter(
          (e) =>
            normalize(e.merchant) === merchantKey &&
            e.date &&
            typeof (e.date as { toDate?: () => Date }).toDate === "function"
        )

        if (merchantExpenses.length < 2) return

        const dates = merchantExpenses
          .map((e) => (e.date as { toDate: () => Date }).toDate())
          .sort((a, b) => a.getTime() - b.getTime())

        const gaps: number[] = []
        for (let i = 1; i < dates.length; i++) {
          gaps.push(Math.round((dates[i].getTime() - dates[i - 1].getTime()) / 86_400_000))
        }
        const sorted = [...gaps].sort((a, b) => a - b)
        const med = sorted[Math.floor(sorted.length / 2)]

        let freq = ""
        if (med >= 6 && med <= 8) freq = "semanal"
        else if (med >= 13 && med <= 16) freq = "quincenal"
        else if (med >= 26 && med <= 35) freq = "mensual"
        else if (med >= 340 && med <= 390) freq = "anual"

        if (!freq) return

        const consistent = gaps.every((g) => med > 0 && Math.abs(g - med) / med <= 0.30)
        if (!consistent && merchantExpenses.length < 4) return

        toast.info(`¿"${input.merchant}" es ${freq}?`, {
          description: "Parece que lo añades regularmente. Rastréalo como gasto recurrente.",
          action: {
            label: "Rastrear",
            onClick: () => { window.location.href = "/recurring" },
          },
          duration: 8_000,
        })
      } catch { /* ignore — hint is best-effort */ }
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
