"use client"

import { useMemo, useCallback } from "react"
import { useExpensesPeriod } from "@/hooks/use-expenses"
import { useRecurring } from "@/hooks/use-recurring"
import { useUIStore } from "@/stores/ui-store"
import { formatCurrency, cn } from "@/lib/utils"
import {
  startOfDay, endOfDay, subDays,
  startOfWeek, endOfWeek,
  isSameDay, isToday, isYesterday,
  differenceInDays, addWeeks, addMonths, addYears,
  format,
} from "date-fns"
import { es } from "date-fns/locale"
import { Skeleton } from "@/components/ui/skeleton"
import {
  TrendingUp, TrendingDown, Minus,
  CalendarClock, Receipt, Pencil,
  Trophy, Flame, Zap,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import type { Expense } from "@/types"
import type { RecurringFrequency } from "@/types"

// ─── helpers ──────────────────────────────────────────────────────────────────

function expenseDate(e: Expense): Date {
  return (e.date as { toDate(): Date }).toDate()
}

function nextOccurrence(freq: RecurringFrequency, from: Date): Date {
  switch (freq) {
    case "weekly":   return addWeeks(from, 1)
    case "biweekly": return addWeeks(from, 2)
    case "monthly":  return addMonths(from, 1)
    case "yearly":   return addYears(from, 1)
  }
}

// ─── TodaySpend ───────────────────────────────────────────────────────────────

function TodaySpend({ expenses30, isLoading }: { expenses30: Expense[]; isLoading: boolean }) {
  const { activeAccount } = useUIStore()

  const { todayTotal, dailyAvg } = useMemo(() => {
    const filtered = activeAccount === "business"
      ? expenses30.filter(e => e.account === "business")
      : expenses30.filter(e => e.account !== "business")

    const today = startOfDay(new Date())
    const todayTotal = filtered
      .filter(e => isSameDay(expenseDate(e), today))
      .reduce((s, e) => s + e.total, 0)

    const dailyAvg = filtered.reduce((s, e) => s + e.total, 0) / 30
    return { todayTotal, dailyAvg }
  }, [expenses30, activeAccount])

  const overBudget = dailyAvg > 0 && todayTotal > dailyAvg
  const pct = dailyAvg > 0 ? Math.min((todayTotal / dailyAvg) * 100, 100) : 0

  if (isLoading) return <Skeleton className="h-[96px] rounded-2xl" />

  return (
    <div className="rounded-2xl border bg-card px-4 py-3 space-y-2">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Hoy</p>
      <p className={cn("text-2xl font-bold tabular-nums leading-none", overBudget && "text-destructive")}>
        {formatCurrency(todayTotal)}
      </p>
      {dailyAvg > 0 && (
        <>
          <div className="h-1 rounded-full bg-border overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", overBudget ? "bg-destructive" : "bg-primary")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Media diaria {formatCurrency(dailyAvg)}
          </p>
        </>
      )}
    </div>
  )
}

// ─── SpendStreak ──────────────────────────────────────────────────────────────

function SpendStreak({ expenses30, isLoading }: { expenses30: Expense[]; isLoading: boolean }) {
  const { activeAccount } = useUIStore()

  const streak = useMemo(() => {
    const filtered = activeAccount === "business"
      ? expenses30.filter(e => e.account === "business")
      : expenses30.filter(e => e.account !== "business")

    const dailyAvg = filtered.reduce((s, e) => s + e.total, 0) / 30
    if (dailyAvg <= 0) return 0

    const byDay = new Map<string, number>()
    filtered.forEach(e => {
      const k = format(expenseDate(e), "yyyy-MM-dd")
      byDay.set(k, (byDay.get(k) ?? 0) + e.total)
    })

    let count = 0
    for (let i = 1; i <= 30; i++) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd")
      const dayTotal = byDay.get(d) ?? 0
      if (dayTotal <= dailyAvg) count++
      else break
    }
    return count
  }, [expenses30, activeAccount])

  if (isLoading) return <Skeleton className="h-[96px] rounded-2xl" />

  const StreakIcon = streak >= 14 ? Trophy : streak >= 7 ? Flame : Zap

  return (
    <div className="rounded-2xl border bg-card px-4 py-3 flex flex-col items-center justify-center text-center h-full gap-1.5">
      <StreakIcon className={cn(
        "h-5 w-5",
        streak >= 14 ? "text-warning" : streak >= 7 ? "text-warning" : streak >= 3 ? "text-primary" : "text-muted-foreground/40"
      )} />
      <p className="text-2xl font-bold tabular-nums leading-none">{streak}</p>
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {streak === 1 ? "día en racha" : "días en racha"}
      </p>
    </div>
  )
}

// ─── WeekComparison ───────────────────────────────────────────────────────────

function WeekComparison({ expenses30, isLoading }: { expenses30: Expense[]; isLoading: boolean }) {
  const { activeAccount } = useUIStore()

  const { thisWeek, lastWeek, delta } = useMemo(() => {
    const filtered = activeAccount === "business"
      ? expenses30.filter(e => e.account === "business")
      : expenses30.filter(e => e.account !== "business")

    const now = new Date()
    const wsStart = startOfWeek(now, { weekStartsOn: 1 })
    const wsEnd   = endOfWeek(now, { weekStartsOn: 1 })
    const lwStart = startOfWeek(subDays(now, 7), { weekStartsOn: 1 })
    const lwEnd   = endOfWeek(subDays(now, 7), { weekStartsOn: 1 })

    const thisWeek = filtered
      .filter(e => { const d = expenseDate(e); return d >= wsStart && d <= wsEnd })
      .reduce((s, e) => s + e.total, 0)
    const lastWeek = filtered
      .filter(e => { const d = expenseDate(e); return d >= lwStart && d <= lwEnd })
      .reduce((s, e) => s + e.total, 0)
    const delta = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0
    return { thisWeek, lastWeek, delta }
  }, [expenses30, activeAccount])

  if (isLoading) return <Skeleton className="h-[72px] rounded-2xl" />

  const isUp   = delta > 2
  const isDown = delta < -2
  const Icon   = isUp ? TrendingUp : isDown ? TrendingDown : Minus

  return (
    <div className="rounded-2xl border bg-card px-4 py-3 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">Esta semana</p>
        <p className="text-xl font-bold tabular-nums">{formatCurrency(thisWeek)}</p>
      </div>
      <div className={cn(
        "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold",
        isUp   ? "bg-destructive/10 text-destructive"
        : isDown ? "bg-green-500/10 text-green-600 dark:text-green-400"
        : "bg-muted text-muted-foreground"
      )}>
        <Icon className="h-3.5 w-3.5" />
        {Math.abs(delta) < 1 ? "igual" : `${Math.abs(delta).toFixed(0)}%`}
      </div>
      <div className="flex-1 min-w-0 text-right">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">Sem. pasada</p>
        <p className="text-xl font-bold tabular-nums text-muted-foreground">{formatCurrency(lastWeek)}</p>
      </div>
    </div>
  )
}

// ─── NextRecurring ────────────────────────────────────────────────────────────

function NextRecurring() {
  const { data: templates = [], isLoading } = useRecurring()

  const next = useMemo(() => {
    const now = new Date()
    return templates
      .filter(t => t.isActive)
      .map(t => {
        let due = t.nextDueDate.toDate()
        while (due < startOfDay(now)) {
          due = nextOccurrence(t.frequency, due)
        }
        return { ...t, dueDate: due }
      })
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0] ?? null
  }, [templates])

  if (isLoading) return <Skeleton className="h-[64px] rounded-2xl" />
  if (!next) return null

  const days = differenceInDays(next.dueDate, startOfDay(new Date()))
  const label = days === 0 ? "Hoy" : days === 1 ? "Mañana" : `En ${days} días`
  const urgent = days <= 2

  return (
    <Link href="/recurring">
      <div className={cn(
        "rounded-2xl border px-4 py-3 flex items-center gap-3 transition-colors hover:bg-accent/40 cursor-pointer",
        urgent ? "bg-warning/8 border-warning/20" : "bg-card"
      )}>
        <div className={cn(
          "h-8 w-8 rounded-xl flex items-center justify-center shrink-0",
          urgent ? "bg-warning/15" : "bg-muted"
        )}>
          <CalendarClock className={cn("h-4 w-4", urgent ? "text-warning" : "text-muted-foreground")} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Próximo recurrente</p>
          <p className="text-sm font-semibold truncate leading-snug">{next.merchant}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={cn("text-sm font-bold tabular-nums", urgent && "text-warning")}>
            {formatCurrency(next.total, next.currency)}
          </p>
          <p className={cn("text-[10px] font-medium", urgent ? "text-warning" : "text-muted-foreground")}>
            {label}
          </p>
        </div>
      </div>
    </Link>
  )
}

// ─── LastExpense ──────────────────────────────────────────────────────────────

function LastExpense({ expenses30, isLoading }: { expenses30: Expense[]; isLoading: boolean }) {
  const { setEditExpense, activeAccount } = useUIStore()

  const last = useMemo(() => {
    const filtered = activeAccount === "business"
      ? expenses30.filter(e => e.account === "business")
      : expenses30.filter(e => e.account !== "business")
    return filtered[0] ?? null
  }, [expenses30, activeAccount])

  if (isLoading) return <Skeleton className="h-[64px] rounded-2xl" />
  if (!last) return null

  const d = expenseDate(last)
  const when = isToday(d) ? `Hoy ${format(d, "HH:mm")}`
    : isYesterday(d) ? "Ayer"
    : format(d, "d MMM", { locale: es })

  return (
    <div className="rounded-2xl border bg-card px-4 py-3 flex items-center gap-3">
      <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
        <Receipt className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Último gasto</p>
        <p className="text-sm font-semibold truncate leading-snug">{last.merchant}</p>
      </div>
      <div className="text-right shrink-0 flex items-center gap-2">
        <div>
          <p className="text-sm font-bold tabular-nums">{formatCurrency(last.total, last.currency)}</p>
          <p className="text-[10px] text-muted-foreground">{when}</p>
        </div>
        <button
          onClick={() => setEditExpense(last)}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Editar"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ResumenWidgets() {
  const now = useMemo(() => new Date(), [])
  const start30 = useMemo(() => subDays(startOfDay(now), 29), [now])

  const { data: expenses30 = [], isLoading } = useExpensesPeriod(start30, endOfDay(now))

  return (
    <div className="space-y-2.5">
      {/* Row 1: Hoy + Racha */}
      <div className="grid grid-cols-2 gap-2.5">
        <TodaySpend expenses30={expenses30} isLoading={isLoading} />
        <SpendStreak expenses30={expenses30} isLoading={isLoading} />
      </div>

      {/* Row 2: Esta semana vs pasada */}
      <WeekComparison expenses30={expenses30} isLoading={isLoading} />

      {/* Row 3: Próximo recurrente */}
      <NextRecurring />

      {/* Row 4: Último gasto */}
      <LastExpense expenses30={expenses30} isLoading={isLoading} />
    </div>
  )
}
