"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  startOfDay, endOfDay, subDays,
  startOfWeek, endOfWeek,
  isSameDay, isToday, isYesterday,
  differenceInDays, addWeeks, addMonths, addYears,
  format,
} from "date-fns"
import { es } from "date-fns/locale"
import {
  TrendingUp, TrendingDown, Minus,
  CalendarClock, Trophy, Flame, Zap,
  ArrowRight,
} from "lucide-react"
import { useExpensesPeriod } from "@/hooks/use-expenses"
import { useRecurring } from "@/hooks/use-recurring"
import { useUIStore } from "@/stores/ui-store"
import { formatCurrency, cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import type { Expense } from "@/types"
import type { RecurringFrequency } from "@/types"

// ─── helpers ──────────────────────────────────────────────────────────────────

function expDate(e: Expense): Date {
  return (e.date as { toDate(): Date }).toDate()
}

function nextOcc(freq: RecurringFrequency, from: Date): Date {
  switch (freq) {
    case "weekly":   return addWeeks(from, 1)
    case "biweekly": return addWeeks(from, 2)
    case "monthly":  return addMonths(from, 1)
    case "yearly":   return addYears(from, 1)
  }
}

// ─── individual cells ─────────────────────────────────────────────────────────

function TodayCell({ expenses30 }: { expenses30: Expense[] }) {
  const { activeAccount } = useUIStore()

  const { todayTotal, dailyAvg } = useMemo(() => {
    const f = activeAccount === "business"
      ? expenses30.filter(e => e.account === "business")
      : expenses30.filter(e => e.account !== "business")
    const today = startOfDay(new Date())
    const todayTotal = f.filter(e => isSameDay(expDate(e), today)).reduce((s, e) => s + e.total, 0)
    const dailyAvg = f.reduce((s, e) => s + e.total, 0) / 30
    return { todayTotal, dailyAvg }
  }, [expenses30, activeAccount])

  const overBudget = dailyAvg > 0 && todayTotal > dailyAvg
  const pct = dailyAvg > 0 ? Math.min((todayTotal / dailyAvg) * 100, 100) : 0

  return (
    <div className={cn(
      "rounded-2xl border p-4 space-y-2 transition-colors",
      overBudget ? "border-destructive/30 bg-destructive/5" : "bg-card"
    )}>
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Hoy</p>
      <p className={cn("text-2xl font-black tabular-nums leading-none", overBudget && "text-destructive")}>
        {formatCurrency(todayTotal)}
      </p>
      {dailyAvg > 0 && (
        <>
          <div className="h-1 rounded-full bg-border overflow-hidden">
            <div
              className={cn("h-full rounded-full", overBudget ? "bg-destructive" : "bg-primary")}
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

function StreakCell({ expenses30 }: { expenses30: Expense[] }) {
  const { activeAccount } = useUIStore()

  const streak = useMemo(() => {
    const f = activeAccount === "business"
      ? expenses30.filter(e => e.account === "business")
      : expenses30.filter(e => e.account !== "business")
    const dailyAvg = f.reduce((s, e) => s + e.total, 0) / 30
    if (dailyAvg <= 0) return 0
    const byDay = new Map<string, number>()
    f.forEach(e => {
      const k = format(expDate(e), "yyyy-MM-dd")
      byDay.set(k, (byDay.get(k) ?? 0) + e.total)
    })
    let count = 0
    for (let i = 1; i <= 30; i++) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd")
      if ((byDay.get(d) ?? 0) <= dailyAvg) count++
      else break
    }
    return count
  }, [expenses30, activeAccount])

  const Icon = streak >= 14 ? Trophy : streak >= 7 ? Flame : Zap
  const iconColor = streak >= 14 ? "text-warning" : streak >= 7 ? "text-orange-500" : streak >= 3 ? "text-primary" : "text-muted-foreground/40"

  return (
    <div className="rounded-2xl border bg-card p-4 flex flex-col items-center justify-center text-center gap-1.5 h-full">
      <Icon className={cn("h-5 w-5", iconColor)} />
      <p className="text-2xl font-black tabular-nums leading-none">{streak}</p>
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground leading-tight">
        {streak === 1 ? "día racha" : "días racha"}
      </p>
    </div>
  )
}

function WeekCompareCell({ expenses30 }: { expenses30: Expense[] }) {
  const { activeAccount } = useUIStore()

  const { thisWeek, lastWeek, delta } = useMemo(() => {
    const f = activeAccount === "business"
      ? expenses30.filter(e => e.account === "business")
      : expenses30.filter(e => e.account !== "business")
    const now = new Date()
    const wsStart = startOfWeek(now, { weekStartsOn: 1 })
    const wsEnd   = endOfWeek(now, { weekStartsOn: 1 })
    const lwStart = startOfWeek(subDays(now, 7), { weekStartsOn: 1 })
    const lwEnd   = endOfWeek(subDays(now, 7), { weekStartsOn: 1 })
    const thisWeek = f.filter(e => { const d = expDate(e); return d >= wsStart && d <= wsEnd }).reduce((s, e) => s + e.total, 0)
    const lastWeek = f.filter(e => { const d = expDate(e); return d >= lwStart && d <= lwEnd }).reduce((s, e) => s + e.total, 0)
    const delta = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0
    return { thisWeek, lastWeek, delta }
  }, [expenses30, activeAccount])

  const isUp   = delta > 2
  const isDown = delta < -2
  const DeltaIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus

  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Esta semana</p>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xl font-black tabular-nums leading-none">{formatCurrency(thisWeek)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            vs {formatCurrency(lastWeek)} sem. ant.
          </p>
        </div>
        <div className={cn(
          "flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0",
          isUp   ? "bg-destructive/10 text-destructive" :
          isDown ? "bg-income/10 text-income" :
                   "bg-muted text-muted-foreground"
        )}>
          <DeltaIcon className="h-3.5 w-3.5" />
          {Math.abs(delta) < 1 ? "igual" : `${Math.abs(delta).toFixed(0)}%`}
        </div>
      </div>
    </div>
  )
}

function NextRecurringCell() {
  const { data: templates = [] } = useRecurring()

  const next = useMemo(() => {
    const now = new Date()
    return templates
      .filter(t => t.isActive)
      .map(t => {
        let due = t.nextDueDate.toDate()
        while (due < startOfDay(now)) due = nextOcc(t.frequency, due)
        return { ...t, dueDate: due }
      })
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0] ?? null
  }, [templates])

  if (!next) return null

  const days = differenceInDays(next.dueDate, startOfDay(new Date()))
  const label = days === 0 ? "Hoy" : days === 1 ? "Mañana" : `En ${days} días`
  const urgent = days <= 2

  return (
    <Link href="/recurring">
      <div className={cn(
        "rounded-2xl border p-4 flex items-center gap-3 hover:bg-accent/40 transition-colors cursor-pointer",
        urgent ? "border-warning/30 bg-warning/5" : "bg-card"
      )}>
        <div className={cn(
          "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
          urgent ? "bg-warning/15" : "bg-muted"
        )}>
          <CalendarClock className={cn("h-4 w-4", urgent ? "text-warning" : "text-muted-foreground")} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Próximo recurrente</p>
          <p className="text-sm font-bold truncate leading-tight mt-0.5">{next.merchant}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={cn("text-sm font-black tabular-nums", urgent && "text-warning")}>
            {formatCurrency(next.total, next.currency)}
          </p>
          <p className={cn("text-[10px] font-medium", urgent ? "text-warning" : "text-muted-foreground")}>
            {label}
          </p>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </div>
    </Link>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function KPIBento() {
  const now = useMemo(() => new Date(), [])
  const start30 = useMemo(() => subDays(startOfDay(now), 29), [now])
  const { data: expenses30 = [], isLoading } = useExpensesPeriod(start30, endOfDay(now))

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-3 kpi-stagger">
      {/* Row 1: Hoy + Racha */}
      <div className="grid grid-cols-2 gap-3">
        <TodayCell expenses30={expenses30} />
        <StreakCell expenses30={expenses30} />
      </div>
      {/* Row 2: Semana */}
      <div>
        <WeekCompareCell expenses30={expenses30} />
      </div>
      {/* Row 3: Próximo recurrente */}
      <div>
        <NextRecurringCell />
      </div>
    </div>
  )
}
