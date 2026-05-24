"use client"

import { useMemo } from "react"
import { useExpenses } from "@/hooks/use-expenses"
import { useUIStore } from "@/stores/ui-store"
import { formatCurrency, cn } from "@/lib/utils"
import {
  startOfWeek, endOfWeek, subWeeks,
  isWithinInterval, format, isSameDay, isFuture, startOfDay,
} from "date-fns"
import { es } from "date-fns/locale"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowDown, ArrowUp, Pencil, Store, CheckCircle2,
} from "lucide-react"
import type { Expense } from "@/types"

// ─── helpers ──────────────────────────────────────────────────────────────────

function expDate(e: Expense): Date {
  return (e.date as { toDate(): Date }).toDate()
}

function useWeekData() {
  const now = new Date()
  const { activeAccount } = useUIStore()
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 })
  const thisWeekEnd   = endOfWeek(now, { weekStartsOn: 1 })
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })

  const { data: result, isLoading } = useExpenses({
    startDate: lastWeekStart,
    endDate: thisWeekEnd,
    sort: "date_desc",
    account: activeAccount,
  })

  const expenses = result?.expenses ?? []

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(thisWeekStart)
      day.setDate(day.getDate() + i)
      const dayEnd = new Date(day)
      dayEnd.setHours(23, 59, 59, 999)

      const dayExpenses = expenses.filter(e =>
        isWithinInterval(expDate(e), { start: day, end: dayEnd })
      )
      const total = dayExpenses.reduce((s, e) => s + e.total, 0)

      return {
        date: day,
        label: format(day, "EEEEE", { locale: es }).toUpperCase(),
        dayNum: format(day, "d"),
        total,
        expenses: dayExpenses,
        isToday: isSameDay(day, now),
        isFutureDay: isFuture(startOfDay(day)) && !isSameDay(day, now),
      }
    })
  }, [expenses, thisWeekStart, now])

  return { days, expenses, isLoading, now }
}

// ─── 1. Mini calendario ───────────────────────────────────────────────────────

export function WeekCalendar() {
  const { days, isLoading } = useWeekData()

  const maxTotal = useMemo(
    () => Math.max(...days.map(d => d.total), 1),
    [days]
  )

  function barColor(total: number, isFutureDay: boolean) {
    if (isFutureDay || total === 0) return "bg-border"
    const pct = total / maxTotal
    if (pct >= 0.75) return "bg-destructive"
    if (pct >= 0.4)  return "bg-amber-400"
    return "bg-green-500"
  }

  function barHeight(total: number, isFutureDay: boolean): number {
    if (isFutureDay || total === 0) return 4
    return Math.max(Math.round((total / maxTotal) * 28), 6)
  }

  if (isLoading) return <Skeleton className="h-[100px] rounded-2xl" />

  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
        Semana actual
      </p>
      <div className="flex items-end gap-1">
        {days.map((d) => (
          <div key={d.dayNum} className="flex-1 flex flex-col items-center gap-1.5">
            {/* Day letter */}
            <span className={cn(
              "text-[9px] font-mono",
              d.isToday ? "text-primary font-bold" : "text-muted-foreground"
            )}>
              {d.label}
            </span>

            {/* Day number */}
            <div className={cn(
              "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold",
              d.isToday
                ? "bg-primary text-primary-foreground"
                : "text-foreground"
            )}>
              {d.dayNum}
            </div>

            {/* Bar */}
            <div className="w-full flex items-end justify-center" style={{ height: 32 }}>
              <div
                className={cn("w-full rounded-sm transition-all", barColor(d.total, d.isFutureDay))}
                style={{ height: barHeight(d.total, d.isFutureDay) }}
              />
            </div>

            {/* Amount */}
            <span className={cn(
              "text-[8px] tabular-nums font-mono text-center leading-none",
              d.isFutureDay || d.total === 0
                ? "text-muted-foreground/30"
                : d.total === maxTotal
                ? "text-destructive font-semibold"
                : "text-muted-foreground"
            )}>
              {d.total > 0
                ? d.total >= 1000 ? `${(d.total / 1000).toFixed(1)}k` : d.total.toFixed(0)
                : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 3. Día más caro y más económico ─────────────────────────────────────────

export function BestWorstDay() {
  const { days, isLoading } = useWeekData()

  const { cheapest, priciest } = useMemo(() => {
    const withSpend = days.filter(d => !d.isFutureDay && d.total > 0)
    if (withSpend.length < 2) return { cheapest: null, priciest: null }
    const sorted = [...withSpend].sort((a, b) => a.total - b.total)
    return { cheapest: sorted[0], priciest: sorted[sorted.length - 1] }
  }, [days])

  if (isLoading) return <Skeleton className="h-[72px] rounded-2xl" />
  if (!cheapest || !priciest) return null

  return (
    <div className="grid grid-cols-2 gap-2">
      {/* Más económico */}
      <div className="rounded-2xl border bg-card px-3 py-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <ArrowDown className="h-3 w-3 text-green-600" />
          <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
            Más económico
          </p>
        </div>
        <p className="text-sm font-bold capitalize leading-tight">
          {format(cheapest.date, "EEEE", { locale: es })}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
          {formatCurrency(cheapest.total)}
        </p>
      </div>

      {/* Más caro */}
      <div className="rounded-2xl border bg-card px-3 py-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <ArrowUp className="h-3 w-3 text-destructive" />
          <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
            Más caro
          </p>
        </div>
        <p className="text-sm font-bold capitalize leading-tight">
          {format(priciest.date, "EEEE", { locale: es })}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
          {formatCurrency(priciest.total)}
        </p>
      </div>
    </div>
  )
}

// ─── 6. Comercios nuevos esta semana ─────────────────────────────────────────

export function NewMerchants() {
  const { expenses, isLoading } = useWeekData()
  const now = new Date()
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 })
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
  const lastWeekEnd   = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })

  const newMerchants = useMemo(() => {
    const prevMerchants = new Set(
      expenses
        .filter(e => { const d = expDate(e); return d >= lastWeekStart && d <= lastWeekEnd })
        .map(e => e.merchant.trim().toLowerCase())
    )

    const thisWeekMerchants = expenses.filter(e => expDate(e) >= thisWeekStart)
    const seen = new Set<string>()
    const result: string[] = []

    for (const e of thisWeekMerchants) {
      const key = e.merchant.trim().toLowerCase()
      if (!prevMerchants.has(key) && !seen.has(key)) {
        seen.add(key)
        result.push(e.merchant.trim())
      }
    }
    return result
  }, [expenses, thisWeekStart, lastWeekStart, lastWeekEnd])

  if (isLoading) return <Skeleton className="h-[64px] rounded-2xl" />
  if (newMerchants.length === 0) return null

  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Store className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {newMerchants.length === 1
            ? "1 comercio nuevo esta semana"
            : `${newMerchants.length} comercios nuevos esta semana`}
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {newMerchants.slice(0, 5).map(m => (
          <span
            key={m}
            className="inline-flex px-2 py-0.5 rounded-full bg-muted border text-xs font-medium truncate max-w-[140px]"
          >
            {m}
          </span>
        ))}
        {newMerchants.length > 5 && (
          <span className="inline-flex px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">
            +{newMerchants.length - 5}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── 8. Feed de gastos de hoy ─────────────────────────────────────────────────

export function TodayFeed() {
  const { days, isLoading } = useWeekData()
  const { setEditExpense } = useUIStore()

  const today = useMemo(() => days.find(d => d.isToday), [days])
  const todayExpenses = today?.expenses ?? []

  if (isLoading) return <Skeleton className="h-[80px] rounded-2xl" />

  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Hoy · {todayExpenses.length} {todayExpenses.length === 1 ? "gasto" : "gastos"}
        </p>
        {today && today.total > 0 && (
          <span className="text-xs font-bold tabular-nums">
            {formatCurrency(today.total)}
          </span>
        )}
      </div>

      {todayExpenses.length === 0 ? (
        <div className="flex items-center gap-2 py-2 text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <p className="text-xs">Sin gastos registrados hoy</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {todayExpenses.slice(0, 5).map(e => (
            <div key={e.id} className="flex items-center gap-2 py-1.5 group rounded-lg hover:bg-muted/40 -mx-1 px-1 transition-colors">
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium truncate block leading-tight">
                  {e.merchant}
                </span>
              </div>
              <span className="text-xs tabular-nums font-semibold shrink-0">
                {formatCurrency(e.total, e.currency)}
              </span>
              <button
                onClick={() => setEditExpense(e)}
                className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-all shrink-0"
                aria-label="Editar"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          ))}
          {todayExpenses.length > 5 && (
            <p className="text-[10px] text-muted-foreground text-center pt-1.5">
              +{todayExpenses.length - 5} más
            </p>
          )}
        </div>
      )}
    </div>
  )
}
