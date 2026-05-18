"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  subDays, startOfDay, endOfDay, startOfMonth, endOfMonth,
  isSameDay, format, differenceInCalendarDays,
} from "date-fns"
import { es } from "date-fns/locale"
import {
  ArrowRight, TrendingUp, TrendingDown,
  ShoppingBag, Zap, Target,
} from "lucide-react"
import { useExpensesPeriod } from "@/hooks/use-expenses"
import { useGoals } from "@/hooks/use-goals"
import { useCategories } from "@/hooks/use-categories"
import { useCategoryBudgets } from "@/hooks/use-category-budgets"
import { useUIStore } from "@/stores/ui-store"
import { formatCurrency, cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

function expDate(e: { date: unknown }): Date {
  return (e.date as { toDate(): Date }).toDate()
}

// ─── Block 1: Mini stats row + top 3 categories ──────────────────────────────

export function QuickStatsBlock() {
  const now = useMemo(() => new Date(), [])
  const { activeAccount } = useUIStore()

  const start30 = useMemo(() => subDays(startOfDay(now), 29), [now])
  const monthStart = useMemo(() => startOfMonth(now), [now])
  const monthEnd   = useMemo(() => endOfMonth(now), [now])

  const { data: expenses30 = [], isLoading } = useExpensesPeriod(start30, endOfDay(now))
  const { data: categories = [] } = useCategories()

  const month = useMemo(
    () => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    [now]
  )
  const { data: budgets = [] } = useCategoryBudgets(month)

  const filtered = useMemo(
    () =>
      expenses30.filter((e) =>
        activeAccount === "business"
          ? e.account === "business"
          : !e.account || e.account === "personal"
      ),
    [expenses30, activeAccount]
  )

  const monthExpenses = useMemo(
    () => filtered.filter((e) => expDate(e) >= monthStart && expDate(e) <= monthEnd),
    [filtered, monthStart, monthEnd]
  )

  // KPIs
  const monthTotal   = monthExpenses.reduce((s, e) => s + e.total, 0)
  const txCount      = monthExpenses.length
  const todayTotal   = useMemo(
    () => filtered.filter((e) => isSameDay(expDate(e), now)).reduce((s, e) => s + e.total, 0),
    [filtered, now]
  )
  const avgPerTx     = txCount > 0 ? monthTotal / txCount : 0
  const daysInMonth  = monthEnd.getDate()
  const dayOfMonth   = now.getDate()
  const dailyAvg     = dayOfMonth > 0 ? monthTotal / dayOfMonth : 0

  // Budget health: % of categories still within limit
  const budgetHealth = useMemo(() => {
    if (budgets.length === 0) return null
    const ok = budgets.filter((b) => {
      const spent = monthExpenses
        .filter((e) => e.category === b.categoryId)
        .reduce((s, e) => s + e.total, 0)
      return spent <= b.amount
    })
    return Math.round((ok.length / budgets.length) * 100)
  }, [budgets, monthExpenses])

  // Top 3 categories this month
  const topCats = useMemo(() => {
    const bycat: Record<string, number> = {}
    monthExpenses.forEach((e) => {
      const k = e.category ?? "otros"
      bycat[k] = (bycat[k] ?? 0) + e.total
    })
    return Object.entries(bycat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, amount]) => {
        const meta = categories.find((c) => c.id === id)
        return { id, amount, name: meta?.name ?? id, icon: meta?.icon ?? "📦" }
      })
  }, [monthExpenses, categories])

  const topAmount = topCats[0]?.amount ?? 1

  if (isLoading) return <Skeleton className="h-44 rounded-2xl" />

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Métricas del mes
          </p>
        </div>
        <Link href="/analytics" className="flex items-center gap-1 text-[11px] font-semibold text-primary">
          Ver análisis <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-4 divide-x divide-border/50 border-b border-border/50">
        {[
          { label: "Gastos", value: txCount.toString(), sub: "transacciones" },
          { label: "Total", value: formatCurrency(monthTotal), sub: "este mes" },
          { label: "Media/día", value: formatCurrency(dailyAvg), sub: "últimos " + dayOfMonth + "d" },
          budgetHealth !== null
            ? { label: "Salud", value: `${budgetHealth}%`, sub: "presupuestos OK", accent: budgetHealth >= 70 }
            : { label: "Ticket", value: formatCurrency(avgPerTx), sub: "por gasto" },
        ].map((k, i) => (
          <div key={i} className="flex flex-col items-center justify-center py-3 px-1 text-center">
            <p className={cn(
              "text-sm font-black tabular-nums leading-tight",
              "accent" in k && k.accent ? "text-emerald-500" : ""
            )}>
              {k.value}
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Top 3 categories */}
      {topCats.length > 0 ? (
        <div className="p-3 space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-1">
            Top categorías
          </p>
          {topCats.map((cat) => (
            <div key={cat.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm shrink-0">{cat.icon}</span>
                <span className="text-xs font-semibold flex-1 truncate">{cat.name}</span>
                <span className="text-xs font-bold tabular-nums shrink-0">
                  {formatCurrency(cat.amount)}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 w-7 text-right">
                  {Math.round((cat.amount / topAmount) * 100)}%
                </span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden ml-6">
                <div
                  className="h-full rounded-full bg-primary/70 transition-all duration-700"
                  style={{ width: `${(cat.amount / topAmount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 text-center text-xs text-muted-foreground">
          Sin gastos este mes aún
        </div>
      )}
    </div>
  )
}

// ─── Block 2: últimos movimientos + metas rápidas ────────────────────────────

export function QuickRecentBlock() {
  const now = useMemo(() => new Date(), [])
  const { activeAccount, setEditExpense } = useUIStore()

  const start7 = useMemo(() => subDays(startOfDay(now), 6), [now])
  const { data: expenses7 = [], isLoading: expLoading } = useExpensesPeriod(start7, endOfDay(now))
  const { data: goals = [], isLoading: goalsLoading } = useGoals()
  const { data: categories = [] } = useCategories()

  const filtered = useMemo(
    () =>
      expenses7.filter((e) =>
        activeAccount === "business"
          ? e.account === "business"
          : !e.account || e.account === "personal"
      ),
    [expenses7, activeAccount]
  )

  const recent = useMemo(
    () => [...filtered].sort((a, b) => expDate(b).getTime() - expDate(a).getTime()).slice(0, 4),
    [filtered]
  )

  const activeGoals = useMemo(
    () => goals.filter((g) => g.isActive && g.targetAmount > 0).slice(0, 2),
    [goals]
  )

  if (expLoading || goalsLoading) return <Skeleton className="h-56 rounded-2xl" />

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-3.5 w-3.5 text-primary" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Últimos 7 días
          </p>
        </div>
        <Link href="/expenses" className="flex items-center gap-1 text-[11px] font-semibold text-primary">
          Ver todos <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Recent expenses */}
      {recent.length === 0 ? (
        <div className="px-4 py-6 text-center space-y-1">
          <p className="text-xl">🌱</p>
          <p className="text-xs text-muted-foreground">Sin movimientos esta semana</p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {recent.map((e) => {
            const cat    = categories.find((c) => c.id === e.category)
            const d      = expDate(e)
            const isToday = isSameDay(d, now)
            const daysAgo = differenceInCalendarDays(now, d)
            const label   = isToday ? "Hoy" : daysAgo === 1 ? "Ayer" : format(d, "EEEE", { locale: es })
            return (
              <button
                key={e.id}
                onClick={() => setEditExpense(e)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors text-left"
              >
                <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center shrink-0 text-sm">
                  {cat?.icon ?? "📦"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{e.merchant}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{label} · {cat?.name ?? e.category}</p>
                </div>
                <p className="text-sm font-bold tabular-nums text-destructive shrink-0">
                  -{formatCurrency(e.total, e.currency)}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {/* Goals strip — only if goals exist */}
      {activeGoals.length > 0 && (
        <>
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50 bg-muted/20">
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-primary" />
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Metas activas
              </p>
            </div>
            <Link href="/goals" className="flex items-center gap-1 text-[11px] font-semibold text-primary">
              Ver metas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="px-4 pb-3 pt-1 space-y-2.5">
            {activeGoals.map((g) => {
              const pct     = Math.min(Math.round((g.currentAmount / g.targetAmount) * 100), 100)
              const isClose = pct >= 80
              return (
                <div key={g.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold flex-1 truncate">{g.name}</p>
                    <span className={cn(
                      "text-[10px] font-bold tabular-nums",
                      isClose ? "text-emerald-500" : "text-muted-foreground"
                    )}>
                      {pct}%
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {formatCurrency(g.currentAmount)}/{formatCurrency(g.targetAmount)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        isClose ? "bg-emerald-500" : "bg-primary"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
