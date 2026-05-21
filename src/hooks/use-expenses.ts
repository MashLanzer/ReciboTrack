"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { useEffect } from "react"
import { useAuth } from "./use-auth"
import type { Expense, ExpenseInput } from "@/types"
import { EXPENSES_PER_PAGE } from "@/lib/constants"
import { fireWebhook, buildExpensePayload } from "@/lib/webhook"
import { toast } from "sonner"
import { format } from "date-fns"
import type { CategoryBudget } from "./use-category-budgets"
import { apiFetch, isoToTimestamp, dateToIso } from "@/lib/api-client"

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

/** Convierte un row de la API (fechas ISO) al tipo Expense (con Timestamps) */
function rowToExpense(row: Record<string, unknown>): Expense {
  return {
    id:              row.id as string,
    account:         (row.account as "personal" | "business") ?? undefined,
    merchant:        row.merchant as string,
    date:            isoToTimestamp(row.date as string),
    items:           (row.items as Expense["items"]) ?? [],
    subtotal:        Number(row.subtotal),
    tax:             Number(row.tax),
    total:           Number(row.total),
    paymentMethod:   (row.paymentMethod as string) ?? null,
    reference:       (row.reference as string) ?? null,
    category:        row.category as string,
    currency:        row.currency as string,
    notes:           (row.notes as string) ?? "",
    tags:            (row.tags as string[]) ?? [],
    receiptImageUrl: (row.receiptImageUrl as string) ?? null,
    project:         (row.project as string) ?? undefined,
    privacy:         (row.privacy as "private" | "group" | "public") ?? "private",
    archived:        (row.archived as boolean) ?? false,
    flagged:         (row.flagged as boolean) ?? false,
    flaggedAt:       row.flaggedAt ? isoToTimestamp(row.flaggedAt as string) : undefined,
    recurringId:     (row.recurringId as string) ?? undefined,
    createdAt:       isoToTimestamp(row.createdAt as string),
    updatedAt:       isoToTimestamp(row.updatedAt as string),
  }
}

async function fetchExpenses(
  filters: ExpenseFilters | undefined,
  page: number
): Promise<{ expenses: Expense[]; total: number; allTags: string[] }> {
  const params = new URLSearchParams()
  if (filters?.category)  params.set("category",  filters.category)
  if (filters?.account && filters.account !== "all") params.set("account", filters.account)
  if (filters?.startDate) params.set("startDate", dateToIso(filters.startDate))
  if (filters?.endDate)   params.set("endDate",   dateToIso(filters.endDate))
  if (filters?.search)    params.set("search",    filters.search)
  if (filters?.tags?.length) params.set("tags",   filters.tags.join(","))
  if (filters?.sort)      params.set("sort",      filters.sort)
  params.set("page",  String(page))
  params.set("limit", String(EXPENSES_PER_PAGE))

  const res = await apiFetch(`/api/expenses?${params}`)
  if (!res.ok) throw new Error("Error cargando gastos")
  const json = await res.json() as { expenses: Record<string, unknown>[]; total: number; allTags: string[] }
  return {
    expenses: json.expenses.map(rowToExpense),
    total:    json.total,
    allTags:  json.allTags,
  }
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
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    queryFn: async () => {
      if (!uid) return { expenses: [], total: 0, allTags: [] as string[] }
      return fetchExpenses(filters, filters?.page ?? 1)
    },
  })

  // Prefetch de la siguiente página
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
      queryFn: () => fetchExpenses(nextFilters, page + 1),
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
      if (!user) return [] as Expense[]
      const start = new Date(year, month - 1, 1)
      const end   = new Date(year, month, 0, 23, 59, 59)
      const params = new URLSearchParams({
        startDate: dateToIso(start),
        endDate:   dateToIso(end),
        all:       "true",
      })
      const res = await apiFetch(`/api/expenses?${params}`)
      if (!res.ok) throw new Error("Error cargando gastos del mes")
      const json = await res.json() as { expenses: Record<string, unknown>[] }
      return json.expenses.map(rowToExpense)
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
      const params = new URLSearchParams({
        startDate: dateToIso(start),
        endDate:   dateToIso(end),
        all:       "true",
      })
      const res = await apiFetch(`/api/expenses?${params}`)
      if (!res.ok) throw new Error("Error cargando gastos del período")
      const json = await res.json() as { expenses: Record<string, unknown>[] }
      return json.expenses.map(rowToExpense)
    },
  })
}

export function useAddExpense() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: ExpenseInput) => {
      if (!user) throw new Error("No autenticado")

      const res = await apiFetch("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          ...input,
          date: dateToIso(input.date),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? "Error al guardar el gasto")
      }
      const json = await res.json() as { id: string }
      return json.id
    },

    // Optimistic update
    onMutate: async (input) => {
      if (!user) return
      await queryClient.cancelQueries({ queryKey: ["expenses", user.uid] })

      const tempId = `temp_${Date.now()}`
      const optimistic: Expense = {
        id:             tempId,
        ...input,
        date:           Timestamp.fromDate(input.date),
        createdAt:      Timestamp.now(),
        updatedAt:      Timestamp.now(),
      }

      queryClient.setQueriesData<{ expenses: Expense[]; total: number; allTags: string[] }>(
        { queryKey: ["expenses", user.uid] },
        (old) => {
          if (!old) return old
          return { ...old, expenses: [optimistic, ...old.expenses], total: old.total + 1 }
        }
      )

      return { tempId }
    },

    onSuccess: async (id, input, ctx) => {
      queryClient.invalidateQueries({ queryKey: ["expenses", user?.uid] })
      queryClient.invalidateQueries({ queryKey: ["expenses-month", user?.uid] })
      void ctx

      // Webhook — leer config de perfil
      if (user?.uid) {
        try {
          const res = await apiFetch("/api/profile")
          if (res.ok) {
            const profile = await res.json() as { webhookUrl?: string; webhookEvents?: string[] }
            const webhookUrl    = profile.webhookUrl ?? ""
            const webhookEvents = profile.webhookEvents ?? []
            if (webhookUrl && webhookEvents.includes("new_expense")) {
              void fireWebhook(webhookUrl, buildExpensePayload({
                id, ...input, date: { toDate: () => input.date },
              }))
            }
          }
        } catch { /* ignore */ }
      }

      // Budget alert — usar caché de React Query
      if (!user || (input as { groupId?: string }).groupId) return
      try {
        const currentMonth = format(new Date(), "yyyy-MM")
        // Leer budgets del caché (si ya fueron cargados por use-category-budgets)
        const budgetsCached = queryClient.getQueryData<CategoryBudget[]>(["category-budgets", user.uid, currentMonth])
        const matchingBudget = (budgetsCached ?? []).find((b) => b.categoryId === input.category)
        if (!matchingBudget) return

        const allCached = queryClient.getQueriesData<{ expenses: Expense[]; total: number; allTags: string[] }>({
          queryKey: ["expenses", user.uid],
        })
        const cachedExpenses: Expense[] = []
        for (const [, d] of allCached) {
          if (d?.expenses) cachedExpenses.push(...d.expenses)
        }

        const seenIds = new Set<string>()
        const uniqueExpenses = cachedExpenses.filter((e) => {
          if (seenIds.has(e.id)) return false
          seenIds.add(e.id)
          return true
        })

        const startOfCurrentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        const catExpenses = uniqueExpenses.filter((e) => {
          if (e.category !== input.category) return false
          const d = e.date instanceof Timestamp ? e.date.toDate() : new Date(e.date as unknown as string)
          return d >= startOfCurrentMonth
        })

        const totalSpent = catExpenses.reduce((sum, e) => sum + e.total, 0)
        const budget     = matchingBudget.amount
        const pct        = Math.round((totalSpent / budget) * 100)

        const formatAmt = (n: number) =>
          new Intl.NumberFormat("es", { style: "currency", currency: matchingBudget.currency || "USD", maximumFractionDigits: 0 }).format(n)

        if (totalSpent >= budget) {
          toast.error("Presupuesto superado", {
            description: `Categoría: ${input.category} · ${formatAmt(totalSpent)} de ${formatAmt(budget)} gastado (${pct}%)`,
            duration: 8000,
            action: { label: "Ver presupuestos", onClick: () => { window.location.href = "/budgets" } },
          })
        } else if (totalSpent >= budget * 0.8) {
          toast.warning(`Presupuesto al ${pct}%`, {
            description: `Categoría: ${input.category} · ${formatAmt(totalSpent)} de ${formatAmt(budget)} gastado`,
            duration: 8000,
            action: { label: "Ver presupuestos", onClick: () => { window.location.href = "/budgets" } },
          })
        }
      } catch { /* ignore */ }

      // Recurring hint detector — usa caché
      try {
        const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ")
        const merchantKey = normalize(input.merchant)

        const recurringCached = queryClient.getQueryData<{ merchant: string }[]>(["recurring", user.uid])
        const isAlreadyTracked = (recurringCached ?? []).some(
          (t) => normalize(t.merchant) === merchantKey
        )
        if (isAlreadyTracked) return

        const detectorData = queryClient.getQueryData<Expense[]>(["expenses-detector", user.uid])
        if (!detectorData || detectorData.length < 3) return

        const merchantExpenses = detectorData.filter(
          (e) => normalize(e.merchant) === merchantKey &&
          e.date && typeof (e.date as { toDate?: () => Date }).toDate === "function"
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
        const med    = sorted[Math.floor(sorted.length / 2)]

        let freq = ""
        if (med >= 6  && med <= 8)   freq = "semanal"
        else if (med >= 13 && med <= 16) freq = "quincenal"
        else if (med >= 26 && med <= 35) freq = "mensual"
        else if (med >= 340 && med <= 390) freq = "anual"
        if (!freq) return

        const consistent = gaps.every((g) => med > 0 && Math.abs(g - med) / med <= 0.30)
        if (!consistent && merchantExpenses.length < 4) return

        toast.info(`¿"${input.merchant}" es ${freq}?`, {
          description: "Parece que lo añades regularmente. Rastréalo como gasto recurrente.",
          action: { label: "Rastrear", onClick: () => { window.location.href = "/recurring" } },
          duration: 8_000,
        })
      } catch { /* ignore */ }
    },

    onError: (_err, _input, ctx) => {
      if (ctx) queryClient.invalidateQueries({ queryKey: ["expenses", user?.uid] })
    },
  })
}

export function useUpdateExpense() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<ExpenseInput> }) => {
      if (!user) throw new Error("No autenticado")
      const body: Record<string, unknown> = { ...input }
      if (input.date) body.date = dateToIso(input.date)

      const res = await apiFetch(`/api/expenses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? "Error al actualizar")
      }
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
      const res = await apiFetch(`/api/expenses/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar")
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
      const res = await apiFetch(`/api/expenses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ archived: true }),
      })
      if (!res.ok) throw new Error("Error al archivar")
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
      const res = await apiFetch(`/api/expenses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ archived: false }),
      })
      if (!res.ok) throw new Error("Error al desarchivar")
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
      const res = await apiFetch("/api/expenses?archived=true&all=true")
      if (!res.ok) throw new Error("Error cargando archivados")
      const json = await res.json() as { expenses: Record<string, unknown>[] }
      return json.expenses.map(rowToExpense)
    },
  })
}

export function useFlagExpense() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, flagged }: { id: string; flagged: boolean }) => {
      if (!user) throw new Error("No autenticado")
      const body: Record<string, unknown> = { flagged }
      if (flagged) body.flaggedAt = new Date().toISOString()
      else         body.flaggedAt = null

      const res = await apiFetch(`/api/expenses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Error al marcar gasto")
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
      const res = await apiFetch("/api/expenses?flagged=true&all=true")
      if (!res.ok) throw new Error("Error cargando marcados")
      const json = await res.json() as { expenses: Record<string, unknown>[] }
      return json.expenses.map(rowToExpense)
    },
  })
}
