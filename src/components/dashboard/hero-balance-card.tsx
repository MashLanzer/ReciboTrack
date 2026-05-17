"use client"

import { useState, useMemo } from "react"
import { format, subMonths, addMonths } from "date-fns"
import { es } from "date-fns/locale"
import {
  TrendingUp, TrendingDown, Plus, ChevronLeft,
  ChevronRight, RefreshCw, Trash2,
} from "lucide-react"
import { useIncome, useAddIncome, useDeleteIncome } from "@/hooks/use-income"
import { useExpensesForMonth } from "@/hooks/use-expenses"
import { useUIStore } from "@/stores/ui-store"
import { formatCurrency, cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

// ─── helpers ──────────────────────────────────────────────────────────────────

function SpendBar({ pct }: { pct: number }) {
  const color =
    pct > 90 ? "bg-destructive" :
    pct > 70 ? "bg-amber-500" :
    "bg-emerald-500"

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{pct.toFixed(0)}% del ingreso gastado</span>
        <span className={pct > 90 ? "text-destructive" : pct > 70 ? "text-amber-500" : "text-emerald-600"}>
          {pct > 90 ? "⚠ Al límite" : pct > 70 ? "Cuidado" : "Bien"}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function HeroBalanceCard() {
  const now = new Date()
  const [offset, setOffset] = useState(0)           // 0 = este mes, -1 = anterior…
  const [showIncome, setShowIncome] = useState(false)

  const targetDate = offset === 0 ? now : (offset < 0 ? subMonths(now, -offset) : addMonths(now, offset))
  const y = targetDate.getFullYear()
  const m = targetDate.getMonth() + 1
  const isCurrentMonth = offset === 0

  const { activeAccount, setIncomeAddOpen } = useUIStore()
  const { data: incomeList = [], isLoading: incLoading } = useIncome(y, m)
  const { data: expenses = [], isLoading: expLoading } = useExpensesForMonth(y, m)
  const deleteIncome = useDeleteIncome()

  // Recurring carry-forward
  const prevDate = subMonths(new Date(y, m - 1, 1), 1)
  const { data: prevIncomeList = [] } = useIncome(prevDate.getFullYear(), prevDate.getMonth() + 1)
  const addIncome = useAddIncome()
  const [carryLoading, setCarryLoading] = useState(false)

  const recurringToCarry = useMemo(() =>
    prevIncomeList.filter(prev =>
      prev.recurring &&
      !incomeList.some(cur => cur.source === prev.source && Math.abs(cur.amount - prev.amount) < 0.01)
    ), [prevIncomeList, incomeList]
  )

  async function handleCarry() {
    setCarryLoading(true)
    try {
      await Promise.all(recurringToCarry.map(inc =>
        addIncome.mutateAsync({
          amount: inc.amount, currency: inc.currency, source: inc.source,
          description: inc.description, date: new Date(y, m - 1, 1), recurring: true, account: inc.account,
        })
      ))
    } finally { setCarryLoading(false) }
  }

  const filteredExpenses = useMemo(() =>
    expenses.filter(e =>
      activeAccount === "business" ? e.account === "business" : !e.account || e.account === "personal"
    ), [expenses, activeAccount]
  )

  const totalIncome   = incomeList.reduce((s, i) => s + i.amount, 0)
  const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.total || 0), 0)
  const balance       = totalIncome - totalExpenses
  const spentPct      = totalIncome > 0 ? Math.min((totalExpenses / totalIncome) * 100, 100) : 0
  const isPositive    = balance >= 0

  const monthLabel = format(new Date(y, m - 1), "MMMM yyyy", { locale: es })

  if (incLoading || expLoading) {
    return <Skeleton className="h-52 rounded-3xl" />
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/8 via-card to-primary/4 shadow-xl shadow-primary/5">
      {/* Background glow */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative p-5 space-y-4">

        {/* ── Top row: month nav + add income ────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setOffset(o => o - 1)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold capitalize text-foreground/80 min-w-[120px] text-center">
              {monthLabel}
            </span>
            {!isCurrentMonth ? (
              <button
                onClick={() => setOffset(o => o + 1)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="h-7 w-7" /> /* spacer */
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 rounded-xl border-primary/30 text-primary hover:bg-primary/10 hover:text-primary text-xs font-semibold"
            onClick={() => setIncomeAddOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Ingreso
          </Button>
        </div>

        {/* ── Balance hero ─────────────────────────────────────────────── */}
        <div className="text-center space-y-1">
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            Balance {isCurrentMonth ? "del mes" : "mensual"}
          </p>
          <p className={cn(
            "text-5xl font-black tabular-nums tracking-tight leading-none",
            totalIncome === 0
              ? "text-foreground"
              : isPositive
              ? "text-emerald-500 dark:text-emerald-400"
              : "text-destructive"
          )}>
            {isPositive ? "+" : "-"}{formatCurrency(Math.abs(balance))}
          </p>
          {totalIncome > 0 && (
            <p className={cn(
              "text-sm font-medium",
              isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
            )}>
              {isPositive
                ? `Ahorrando ${formatCurrency(balance)} este mes ✓`
                : "Gastas más de lo que ingresas ⚠"}
            </p>
          )}
        </div>

        {/* ── Income / Expense split ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowIncome(s => !s)}
            className="group rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-3 text-left hover:bg-emerald-500/12 transition-colors"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Ingresos</span>
            </div>
            <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalIncome)}
            </p>
            {incomeList.length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {incomeList.length} entrada{incomeList.length > 1 ? "s" : ""} ·{" "}
                <span className="text-primary">{showIncome ? "ocultar" : "ver"}</span>
              </p>
            )}
          </button>

          <div className="rounded-2xl border border-destructive/20 bg-destructive/8 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Gastos</span>
            </div>
            <p className="text-lg font-bold tabular-nums text-destructive">
              {formatCurrency(totalExpenses)}
            </p>
            {filteredExpenses.length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {filteredExpenses.length} transacción{filteredExpenses.length !== 1 ? "es" : ""}
              </p>
            )}
          </div>
        </div>

        {/* ── Progress bar ──────────────────────────────────────────────── */}
        {totalIncome > 0 && <SpendBar pct={spentPct} />}

        {/* ── Carry-forward prompt ──────────────────────────────────────── */}
        {isCurrentMonth && recurringToCarry.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl bg-blue-500/10 border border-blue-500/20 px-3 py-2.5">
            <RefreshCw className="h-4 w-4 text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                {recurringToCarry.length} ingreso{recurringToCarry.length > 1 ? "s" : ""} recurrente{recurringToCarry.length > 1 ? "s" : ""} pendiente{recurringToCarry.length > 1 ? "s" : ""}
              </p>
              <p className="text-[10px] text-blue-500/80 truncate">
                {recurringToCarry.map(i => i.source).join(", ")}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs shrink-0 bg-blue-500/20 hover:bg-blue-500/30 text-blue-700 dark:text-blue-300 border-0"
              onClick={handleCarry}
              disabled={carryLoading}
            >
              {carryLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Añadir"}
            </Button>
          </div>
        )}
      </div>

      {/* ── Collapsible income list ───────────────────────────────────────── */}
      {showIncome && incomeList.length > 0 && (
        <div className="border-t border-border/60 px-5 py-4 space-y-2 bg-card/50">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
            Ingresos del mes
          </p>
          {incomeList.map(inc => (
            <div key={inc.id} className="flex items-center gap-3 group py-1">
              <div className="h-7 w-7 rounded-lg bg-emerald-500/12 flex items-center justify-center shrink-0">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{inc.source}</p>
                {inc.description && <p className="text-[10px] text-muted-foreground truncate">{inc.description}</p>}
              </div>
              {inc.recurring && (
                <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full shrink-0">
                  Recurrente
                </span>
              )}
              <p className="text-xs font-bold tabular-nums text-emerald-600 shrink-0">
                +{formatCurrency(inc.amount, inc.currency)}
              </p>
              <button
                onClick={() => deleteIncome.mutate(inc.id)}
                className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-all shrink-0"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty income ──────────────────────────────────────────────────── */}
      {totalIncome === 0 && (
        <div className="border-t border-border/60 px-5 pb-4 pt-3 text-center">
          <p className="text-xs text-muted-foreground">
            Sin ingresos este mes.{" "}
            <button
              onClick={() => setIncomeAddOpen(true)}
              className="text-primary hover:underline font-semibold"
            >
              Añadir ingreso →
            </button>
          </p>
        </div>
      )}
    </div>
  )
}
