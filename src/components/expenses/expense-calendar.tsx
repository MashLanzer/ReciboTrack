"use client"

import { useState, useMemo } from "react"
import { useExpensesForMonth } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { formatCurrency, toDate } from "@/lib/utils"
import { DEFAULT_CATEGORIES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { Expense } from "@/types"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ReceiptText,
  CalendarDays,
  X,
} from "lucide-react"
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  isToday,
  format,
  addMonths,
  subMonths,
  isSameMonth,
} from "date-fns"
import { es } from "date-fns/locale"

// ─── Helpers ────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

function heatClass(amount: number, max: number): string {
  if (amount === 0 || max === 0) return ""
  const ratio = amount / max
  if (ratio < 0.15) return "bg-emerald-100 dark:bg-emerald-950/50"
  if (ratio < 0.3)  return "bg-emerald-200 dark:bg-emerald-900/60"
  if (ratio < 0.5)  return "bg-amber-100 dark:bg-amber-950/50"
  if (ratio < 0.75) return "bg-amber-200 dark:bg-amber-900/60"
  return "bg-rose-200 dark:bg-rose-900/60"
}

function heatDotClass(amount: number, max: number): string {
  if (amount === 0 || max === 0) return "bg-muted-foreground/20"
  const ratio = amount / max
  if (ratio < 0.15) return "bg-emerald-400"
  if (ratio < 0.3)  return "bg-emerald-500"
  if (ratio < 0.5)  return "bg-amber-400"
  if (ratio < 0.75) return "bg-amber-500"
  return "bg-rose-500"
}

// ─── Main component ─────────────────────────────────────────────────────────

export function ExpenseCalendar() {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  const { data: expenses = [], isLoading } = useExpensesForMonth(year, month)
  const { data: categories = [] } = useCategories()
  const allCats = categories.length > 0 ? categories : DEFAULT_CATEGORIES

  // ── Build calendar grid ───────────────────────────────────────────────────
  const { dayMap, gridDays, monthTotal, maxDayAmount, totalCount } = useMemo(() => {
    const dayMap = new Map<string, Expense[]>()
    let monthTotal = 0
    let maxDayAmount = 0

    for (const e of expenses) {
      const d = toDate(e.date)
      const key = format(d, "yyyy-MM-dd")
      if (!dayMap.has(key)) dayMap.set(key, [])
      dayMap.get(key)!.push(e)
      monthTotal += e.total
    }

    for (const [, list] of dayMap) {
      const sum = list.reduce((a, b) => a + b.total, 0)
      if (sum > maxDayAmount) maxDayAmount = sum
    }

    // Build 6-row × 7-col grid starting Sunday
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

    // Pad beginning
    const startPad = getDay(monthStart) // 0=Sun
    const paddedDays: (Date | null)[] = [
      ...Array(startPad).fill(null),
      ...daysInMonth,
    ]
    // Pad end to fill last row
    while (paddedDays.length % 7 !== 0) paddedDays.push(null)

    return {
      dayMap,
      gridDays: paddedDays,
      monthTotal,
      maxDayAmount,
      totalCount: expenses.length,
    }
  }, [expenses, currentDate])

  // ── Selected day expenses ─────────────────────────────────────────────────
  const selectedKey = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null
  const selectedExpenses = selectedKey ? (dayMap.get(selectedKey) ?? []) : []
  const selectedTotal = selectedExpenses.reduce((a, b) => a + b.total, 0)

  function toggleDay(d: Date) {
    if (selectedDay && isSameDay(d, selectedDay)) {
      setSelectedDay(null)
    } else {
      setSelectedDay(d)
    }
  }

  function prevMonth() {
    setCurrentDate((d) => subMonths(d, 1))
    setSelectedDay(null)
  }
  function nextMonth() {
    setCurrentDate((d) => addMonths(d, 1))
    setSelectedDay(null)
  }
  function goToday() {
    setCurrentDate(new Date())
    setSelectedDay(null)
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 text-center">
          <button
            onClick={goToday}
            className="text-base font-semibold capitalize hover:text-primary transition-colors"
          >
            {format(currentDate, "MMMM yyyy", { locale: es })}
          </button>
        </div>
        <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Month KPIs ── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
          {isLoading
            ? <Skeleton className="h-5 w-20 mx-auto mt-1" />
            : <p className="text-sm font-semibold mt-0.5">{formatCurrency(monthTotal)}</p>
          }
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Gastos</p>
          {isLoading
            ? <Skeleton className="h-5 w-10 mx-auto mt-1" />
            : <p className="text-sm font-semibold mt-0.5">{totalCount}</p>
          }
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Días act.</p>
          {isLoading
            ? <Skeleton className="h-5 w-10 mx-auto mt-1" />
            : <p className="text-sm font-semibold mt-0.5">{dayMap.size}</p>
          }
        </div>
      </div>

      {/* ── Calendar grid ── */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {gridDays.map((day, i) => {
            if (!day) {
              return (
                <div
                  key={`pad-${i}`}
                  className="aspect-square border-b border-r last:border-r-0 bg-muted/20"
                />
              )
            }

            const key = format(day, "yyyy-MM-dd")
            const dayExpenses = dayMap.get(key) ?? []
            const dayTotal = dayExpenses.reduce((a, b) => a + b.total, 0)
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
            const today = isToday(day)
            const inMonth = isSameMonth(day, currentDate)

            return (
              <button
                key={key}
                onClick={() => inMonth && dayExpenses.length > 0 && toggleDay(day)}
                className={cn(
                  "relative aspect-square border-b border-r last:border-r-0 flex flex-col items-center justify-center gap-0.5 transition-all",
                  inMonth && dayExpenses.length > 0
                    ? "cursor-pointer hover:ring-2 hover:ring-primary/40 hover:z-10"
                    : "cursor-default",
                  isSelected && "ring-2 ring-primary z-10",
                  dayTotal > 0 && !isSelected ? heatClass(dayTotal, maxDayAmount) : "",
                  isSelected ? "bg-primary/15" : "",
                )}
              >
                {/* Day number */}
                <span
                  className={cn(
                    "text-xs sm:text-xs font-medium leading-none",
                    today
                      ? "h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]"
                      : "",
                    !inMonth && "opacity-30",
                    isSelected && "text-primary font-bold",
                  )}
                >
                  {format(day, "d")}
                </span>

                {/* Spend indicator */}
                {dayTotal > 0 && (
                  <>
                    <span
                      className={cn(
                        "h-1 w-1 rounded-full",
                        isSelected ? "bg-primary" : heatDotClass(dayTotal, maxDayAmount)
                      )}
                    />
                    <span className={cn(
                      "text-[9px] leading-none font-medium",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )}>
                      {dayExpenses.length > 1 ? `×${dayExpenses.length}` : ""}
                    </span>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-3 justify-end text-[10px] text-muted-foreground">
        <span>Menos</span>
        <div className="flex gap-1">
          {["bg-emerald-200", "bg-amber-200", "bg-rose-200"].map((c) => (
            <span key={c} className={cn("h-3 w-3 rounded-sm", c)} />
          ))}
        </div>
        <span>Más</span>
      </div>

      {/* ── Selected day panel ── */}
      {selectedDay && selectedExpenses.length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden animate-in slide-in-from-top-2 duration-200">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium capitalize">
                {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-primary">
                {formatCurrency(selectedTotal)}
              </span>
              <button
                onClick={() => setSelectedDay(null)}
                className="h-5 w-5 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Expense list */}
          <div className="divide-y">
            {[...selectedExpenses]
              .sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime())
              .map((e) => {
                const cat = allCats.find((c) => c.id === e.category)
                return (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                    {/* Icon */}
                    <span className="text-xl shrink-0 leading-none">{cat?.icon ?? "📦"}</span>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.merchant}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">{cat?.name ?? e.category}</span>
                        {e.paymentMethod && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            {e.paymentMethod}
                          </Badge>
                        )}
                        {e.tags?.slice(0, 2).map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Amount */}
                    <span className="text-sm font-semibold shrink-0">
                      {formatCurrency(e.total, e.currency)}
                    </span>
                  </div>
                )
              })}
          </div>

          {/* Day summary */}
          {selectedExpenses.length > 1 && (
            <div className="px-4 py-2.5 border-t bg-muted/20 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {selectedExpenses.length} gastos este día
              </span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                <span>Promedio: {formatCurrency(selectedTotal / selectedExpenses.length)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Empty month state ── */}
      {!isLoading && expenses.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <ReceiptText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin gastos en {format(currentDate, "MMMM yyyy", { locale: es })}</p>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      )}
    </div>
  )
}
