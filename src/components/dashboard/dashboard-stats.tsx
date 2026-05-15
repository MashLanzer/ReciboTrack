"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { collection, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "@/hooks/use-auth"
import { useCategories } from "@/hooks/use-categories"
import { useRecurring } from "@/hooks/use-recurring"
import {
  getCurrentMonthRange,
  getPreviousMonthRange,
  percentChange,
  formatCurrency,
} from "@/lib/utils"
import { subMonths, format, startOfMonth, endOfMonth, getDaysInMonth, getDate, addDays, addMonths, addYears, isBefore } from "date-fns"
import { es } from "date-fns/locale"
import type { Expense } from "@/types"
import type { RecurringTemplate, RecurringFrequency } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, Minus, ScanLine, ChevronDown, ChevronUp, RefreshCw, AlertCircle } from "lucide-react"
import { useUIStore } from "@/stores/ui-store"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ComposedChart,
  Line,
} from "recharts"
import { cn } from "@/lib/utils"

// ─── Recurring projection helpers ─────────────────────────────────────────────

function getOccurrencesInRange(template: RecurringTemplate, start: Date, end: Date): Date[] {
  const result: Date[] = []
  let cursor = new Date(template.nextDueDate.toDate())
  cursor.setHours(0, 0, 0, 0)
  const s = new Date(start); s.setHours(0, 0, 0, 0)
  const e = new Date(end);   e.setHours(23, 59, 59, 999)

  if (cursor > e) return []

  let safety = 0
  while (cursor <= e && safety < 200) {
    safety++
    if (cursor >= s) result.push(new Date(cursor))
    switch (template.frequency as RecurringFrequency) {
      case "weekly":   cursor = addDays(cursor, 7);   break
      case "biweekly": cursor = addDays(cursor, 14);  break
      case "monthly":  cursor = addMonths(cursor, 1); break
      case "yearly":   cursor = addYears(cursor, 1);  break
    }
  }
  return result
}

// ─── Data hooks ────────────────────────────────────────────────────────────────

function use12MonthExpenses() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["expenses-12m", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return []
      const start = startOfMonth(subMonths(new Date(), 11))
      const col = collection(getFirebaseDb(), "users", user.uid, "expenses")
      const q = query(col, where("date", ">=", Timestamp.fromDate(start)), orderBy("date", "desc"))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)
    },
  })
}

function usePrevMonthExpenses() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["expenses-prevmonth", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return []
      const { start, end } = getPreviousMonthRange()
      const col = collection(getFirebaseDb(), "users", user.uid, "expenses")
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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function sum(expenses: Expense[]) {
  return expenses.reduce((a, e) => a + (e.total || 0), 0)
}

function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  if (value === 0) return <Minus className="h-3 w-3 text-muted-foreground inline" />
  const bad = invert ? value < 0 : value > 0
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] tabular-nums font-medium", bad ? "text-destructive" : "text-green-600")}>
      {value > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function DashboardStats() {
  const { data: all12 = [], isLoading } = use12MonthExpenses()
  const { data: prev = [] } = usePrevMonthExpenses()
  const { data: categories = [] } = useCategories()
  const { data: recurringTemplates = [] } = useRecurring()
  const { setScannerOpen } = useUIStore()
  const [catExpanded, setCatExpanded] = useState(false)
  const [merchantExpanded, setMerchantExpanded] = useState(false)

  const { start: monthStart, end: monthEnd } = getCurrentMonthRange()

  const current = useMemo(
    () => all12.filter((e) => { const d = e.date.toDate(); return d >= monthStart && d <= monthEnd }),
    [all12, monthStart, monthEnd]
  )

  const currentTotal = sum(current)
  const prevTotal = sum(prev)
  const yearTotal = sum(all12)
  const pct = percentChange(currentTotal, prevTotal)

  const today = new Date()
  const dayOfMonth = getDate(today)
  const daysInCurrentMonth = getDaysInMonth(today)
  const dailyAvg = currentTotal / Math.max(dayOfMonth, 1)
  const projectedTotal = dailyAvg * daysInCurrentMonth
  const highestDay = useMemo(() => {
    const map: Record<string, number> = {}
    current.forEach((e) => {
      const key = format(e.date.toDate(), "yyyy-MM-dd")
      map[key] = (map[key] ?? 0) + e.total
    })
    return Math.max(...Object.values(map), 0)
  }, [current])

  // ── 12-month trend ──────────────────────────────────────────────────────────
  const monthlyTrend = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = subMonths(today, 11 - i)
      const s = startOfMonth(month)
      const e = endOfMonth(month)
      const monthTotal = all12
        .filter((ex) => { const d = ex.date.toDate(); return d >= s && d <= e })
        .reduce((a, ex) => a + ex.total, 0)
      const isCurrent = i === 11
      return {
        month: format(month, "MMM", { locale: es }),
        fullMonth: format(month, "MMMM yyyy", { locale: es }),
        total: monthTotal,
        isCurrent,
      }
    })
  }, [all12, today])

  // ── Category breakdown with delta ──────────────────────────────────────────
  const categoryBreakdown = useMemo(() => {
    const currMap: Record<string, { total: number; count: number }> = {}
    const prevMap: Record<string, number> = {}
    current.forEach((e) => {
      if (!currMap[e.category]) currMap[e.category] = { total: 0, count: 0 }
      currMap[e.category].total += e.total
      currMap[e.category].count++
    })
    prev.forEach((e) => { prevMap[e.category] = (prevMap[e.category] ?? 0) + e.total })
    return Object.entries(currMap)
      .map(([id, { total, count }]) => {
        const cat = categories.find((c) => c.id === id)
        const prevCatTotal = prevMap[id] ?? 0
        return {
          id, name: cat?.name ?? id, icon: cat?.icon ?? "📦",
          color: cat?.color ?? "#6b7280",
          total, count,
          pctOfTotal: currentTotal > 0 ? (total / currentTotal) * 100 : 0,
          delta: percentChange(total, prevCatTotal),
          prevTotal: prevCatTotal,
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [current, prev, categories, currentTotal])

  // ── Daily spending this month ───────────────────────────────────────────────
  const dailyData = useMemo(() => {
    const map: Record<number, number> = {}
    current.forEach((e) => { const d = getDate(e.date.toDate()); map[d] = (map[d] ?? 0) + e.total })
    const days = getDaysInMonth(today)
    return Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      total: map[i + 1] ?? 0,
      isToday: i + 1 === dayOfMonth,
      isFuture: i + 1 > dayOfMonth,
    }))
  }, [current, today, dayOfMonth])

  // ── Top merchants ──────────────────────────────────────────────────────────
  const topMerchants = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {}
    current.forEach((e) => {
      if (!map[e.merchant]) map[e.merchant] = { total: 0, count: 0 }
      map[e.merchant].total += e.total
      map[e.merchant].count++
    })
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([merchant, { total, count }], i) => ({
        rank: i + 1, merchant, total, count, avg: total / count,
        pctOfTotal: currentTotal > 0 ? (total / currentTotal) * 100 : 0,
      }))
  }, [current, currentTotal])

  // ── Payment methods ────────────────────────────────────────────────────────
  const paymentMethods = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {}
    current.forEach((e) => {
      const m = e.paymentMethod ?? "Sin especificar"
      if (!map[m]) map[m] = { total: 0, count: 0 }
      map[m].total += e.total
      map[m].count++
    })
    const total = Object.values(map).reduce((a, v) => a + v.total, 0)
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([method, { total: t, count }]) => ({ method, total: t, count, pct: total > 0 ? (t / total) * 100 : 0 }))
  }, [current])

  if (isLoading) return <DashboardSkeleton />

  if (all12.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 text-center">
        <div className="space-y-2">
          <p className="font-serif text-4xl">Bienvenido</p>
          <p className="text-muted-foreground max-w-xs">
            Escanea tu primer recibo para empezar a controlar tus gastos con IA.
          </p>
        </div>
        <Button size="lg" className="gap-2 h-12 px-8" onClick={() => setScannerOpen(true)}>
          <ScanLine className="h-5 w-5" />
          Escanear primer recibo
        </Button>
      </div>
    )
  }

  const visibleCats = catExpanded ? categoryBreakdown : categoryBreakdown.slice(0, 5)
  const visibleMerchants = merchantExpanded ? topMerchants : topMerchants.slice(0, 5)

  return (
    <div className="space-y-5">
      {/* ── Hero ── */}
      <Card className="grain relative overflow-hidden">
        <CardContent className="pt-5 pb-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
            {format(monthStart, "MMMM yyyy", { locale: es })}
          </p>
          <div className="flex items-end justify-between">
            <p className="font-serif text-5xl tabular-nums leading-none">{formatCurrency(currentTotal)}</p>
            <Delta value={pct} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Proyectado este mes: <span className="font-semibold tabular-nums text-foreground">{formatCurrency(projectedTotal)}</span>
          </p>
        </CardContent>
      </Card>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Mes anterior", value: formatCurrency(prevTotal) },
          { label: "Promedio diario", value: formatCurrency(dailyAvg) },
          { label: "Mayor gasto/día", value: formatCurrency(highestDay) },
          { label: "Año en curso", value: formatCurrency(yearTotal) },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-3 pb-3 px-4">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="tabular-nums text-sm font-semibold mt-1 truncate">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Fixed expense projection ── */}
      {recurringTemplates.length > 0 && (
        <FixedProjectionCard
          templates={recurringTemplates}
          categories={categories}
          monthStart={monthStart}
          monthEnd={monthEnd}
          currentSpend={currentTotal}
          projectedTotal={projectedTotal}
        />
      )}

      {/* ── 12-month bar chart ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Tendencia 12 meses</CardTitle>
        </CardHeader>
        <CardContent className="-mx-2">
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={monthlyTrend} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} width={36} />
              <Tooltip
                formatter={(v) => [formatCurrency(Number(v)), "Total"]}
                labelFormatter={(_: unknown, payload: ReadonlyArray<{ payload?: { fullMonth?: string } }>) => payload?.[0]?.payload?.fullMonth ?? ""}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              />
              <ReferenceLine y={prevTotal} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.4} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {monthlyTrend.map((entry, index) => (
                  <Cell
                    key={index}
                    fill="hsl(var(--foreground))"
                    fillOpacity={entry.isCurrent ? 0.9 : 0.2}
                  />
                ))}
              </Bar>
              <Line type="monotone" dataKey="total" stroke="hsl(var(--foreground))" strokeWidth={1.5} dot={false} strokeOpacity={0.4} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Daily spending bar this month ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Gasto diario — {format(today, "MMMM", { locale: es })}</CardTitle>
        </CardHeader>
        <CardContent className="-mx-2">
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={dailyData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <XAxis dataKey="day" tick={{ fontSize: 9 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => v % 5 === 0 || v === 1 ? String(v) : ""} />
              <YAxis hide />
              <Tooltip
                formatter={(v) => [formatCurrency(Number(v)), "Gasto"]}
                labelFormatter={(v) => `Día ${v}`}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              />
              <Bar dataKey="total" radius={[2, 2, 0, 0]}>
                {dailyData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill="hsl(var(--foreground))"
                    fillOpacity={entry.isFuture ? 0.04 : entry.isToday ? 1 : 0.4}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Category breakdown table ── */}
      {categoryBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Por categoría</CardTitle>
              <p className="text-[10px] text-muted-foreground font-mono">{current.length} transacciones</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-4 py-2">Categoría</th>
                  <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-2">Txns</th>
                  <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-2">%</th>
                  <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-4 py-2">Total</th>
                  <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-4 py-2">vs ant.</th>
                </tr>
              </thead>
              <tbody>
                {visibleCats.map((cat, i) => (
                  <tr key={cat.id} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-muted/20" : "")}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: cat.color }}
                        />
                        <span className="text-xs">{cat.icon}</span>
                        <span className="text-xs font-medium truncate max-w-[90px]">{cat.name}</span>
                      </div>
                    </td>
                    <td className="text-right px-2 py-2.5 tabular-nums text-xs text-muted-foreground">{cat.count}</td>
                    <td className="text-right px-2 py-2.5 tabular-nums text-xs text-muted-foreground">{cat.pctOfTotal.toFixed(1)}%</td>
                    <td className="text-right px-4 py-2.5 tabular-nums text-xs font-semibold">{formatCurrency(cat.total)}</td>
                    <td className="text-right px-4 py-2.5"><Delta value={cat.delta} /></td>
                  </tr>
                ))}
              </tbody>
              {categoryBreakdown.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-muted/30">
                    <td className="px-4 py-2 text-xs font-semibold" colSpan={2}>Total</td>
                    <td className="text-right px-2 py-2 text-xs text-muted-foreground">100%</td>
                    <td className="text-right px-4 py-2 tabular-nums text-xs font-bold">{formatCurrency(currentTotal)}</td>
                    <td className="text-right px-4 py-2"><Delta value={pct} /></td>
                  </tr>
                </tfoot>
              )}
            </table>
            {categoryBreakdown.length > 5 && (
              <button
                onClick={() => setCatExpanded((v) => !v)}
                className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border-t"
              >
                {catExpanded ? <><ChevronUp className="h-3 w-3" /> Ver menos</> : <><ChevronDown className="h-3 w-3" /> Ver {categoryBreakdown.length - 5} más</>}
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Top merchants table ── */}
      {topMerchants.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top comercios</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-4 py-2">#</th>
                  <th className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-2">Comercio</th>
                  <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-2">Visitas</th>
                  <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-2">Promedio</th>
                  <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-4 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {visibleMerchants.map((m, i) => (
                  <tr key={m.merchant} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-muted/20" : "")}>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">{m.rank}</td>
                    <td className="px-2 py-2.5">
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium truncate max-w-[120px]">{m.merchant}</p>
                        <div className="h-1 rounded-full bg-muted overflow-hidden w-20">
                          <div className="h-full rounded-full bg-foreground/50" style={{ width: `${m.pctOfTotal}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="text-right px-2 py-2.5 tabular-nums text-xs text-muted-foreground">{m.count}</td>
                    <td className="text-right px-2 py-2.5 tabular-nums text-xs text-muted-foreground">{formatCurrency(m.avg)}</td>
                    <td className="text-right px-4 py-2.5 tabular-nums text-xs font-semibold">{formatCurrency(m.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {topMerchants.length > 5 && (
              <button
                onClick={() => setMerchantExpanded((v) => !v)}
                className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border-t"
              >
                {merchantExpanded ? <><ChevronUp className="h-3 w-3" /> Ver menos</> : <><ChevronDown className="h-3 w-3" /> Ver {topMerchants.length - 5} más</>}
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Payment methods table ── */}
      {paymentMethods.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Métodos de pago</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-4 py-2">Método</th>
                  <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-2">Txns</th>
                  <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-2">%</th>
                  <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-4 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {paymentMethods.map((m, i) => (
                  <tr key={m.method} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-muted/20" : "")}>
                    <td className="px-4 py-2.5">
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium">{m.method}</p>
                        <div className="h-1 rounded-full bg-muted overflow-hidden w-24">
                          <div className="h-full rounded-full bg-foreground/50" style={{ width: `${m.pct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="text-right px-2 py-2.5 tabular-nums text-xs text-muted-foreground">{m.count}</td>
                    <td className="text-right px-2 py-2.5 tabular-nums text-xs text-muted-foreground">{m.pct.toFixed(1)}%</td>
                    <td className="text-right px-4 py-2.5 tabular-nums text-xs font-semibold">{formatCurrency(m.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Fixed Projection Card ─────────────────────────────────────────────────────

function FixedProjectionCard({
  templates,
  categories,
  monthStart,
  monthEnd,
  currentSpend,
  projectedTotal,
}: {
  templates: RecurringTemplate[]
  categories: { id: string; name: string; icon: string; color?: string }[]
  monthStart: Date
  monthEnd: Date
  currentSpend: number
  projectedTotal: number
}) {
  const today = new Date()

  const { fixedThisMonth, pendingItems, paidCount } = useMemo(() => {
    let fixedThisMonth = 0
    const pending: Array<{ template: RecurringTemplate; dueDate: Date }> = []
    let paidCount = 0

    for (const t of templates) {
      const occurrences = getOccurrencesInRange(t, monthStart, monthEnd)
      for (const dueDate of occurrences) {
        fixedThisMonth += t.total
        // Pending = due date is today or in the future
        if (!isBefore(dueDate, today) || dueDate.toDateString() === today.toDateString()) {
          pending.push({ template: t, dueDate })
        } else {
          paidCount++
        }
      }
    }

    // Sort pending by due date ascending
    pending.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())

    return { fixedThisMonth, pendingItems: pending, paidCount }
  }, [templates, monthStart, monthEnd, today])

  const pendingAmount = pendingItems.reduce((s, { template: t }) => s + t.total, 0)
  const committedTotal = currentSpend + pendingAmount
  // Projection = whatever is higher: the daily-avg projection or what's already committed
  const adjustedProjection = Math.max(projectedTotal, committedTotal)

  // Bar proportions
  const barMax = Math.max(adjustedProjection, committedTotal, 1)
  const spendPct = Math.min((currentSpend / barMax) * 100, 100)
  const pendingPct = Math.min((pendingAmount / barMax) * 100, 100 - spendPct)

  const [expanded, setExpanded] = useState(false)
  const visiblePending = expanded ? pendingItems : pendingItems.slice(0, 3)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            Proyección con gastos fijos
          </CardTitle>
          {pendingItems.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
              <AlertCircle className="h-3 w-3" />
              {pendingItems.length} pendiente{pendingItems.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Gastado</p>
            <p className="text-sm font-bold tabular-nums mt-0.5">{formatCurrency(currentSpend)}</p>
            <p className="text-[10px] text-muted-foreground">hasta hoy</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Pendiente fijo</p>
            <p className="text-sm font-bold tabular-nums mt-0.5 text-amber-600">{formatCurrency(pendingAmount)}</p>
            <p className="text-[10px] text-muted-foreground">{pendingItems.length} recurrente{pendingItems.length !== 1 ? "s" : ""}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Comprometido</p>
            <p className="text-sm font-bold tabular-nums mt-0.5">{formatCurrency(committedTotal)}</p>
            <p className="text-[10px] text-muted-foreground">vs {formatCurrency(adjustedProjection)} proy.</p>
          </div>
        </div>

        {/* Stacked bar */}
        <div className="space-y-1.5">
          <div className="h-3 rounded-full bg-muted overflow-hidden flex">
            <div
              className="h-full bg-foreground transition-all"
              style={{ width: `${spendPct}%` }}
            />
            <div
              className="h-full bg-amber-500/60 transition-all"
              style={{ width: `${pendingPct}%` }}
            />
          </div>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-foreground inline-block" />
              Gastado
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500/60 inline-block" />
              Pendiente fijo
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/30 inline-block" />
              Restante libre
            </span>
          </div>
        </div>

        {/* Pending list */}
        {pendingItems.length > 0 && (
          <div className="space-y-1 border-t pt-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
              Por pagar este mes
            </p>
            {visiblePending.map(({ template: t, dueDate }) => {
              const cat = categories.find((c) => c.id === t.category)
              const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
              const isToday = daysUntil === 0
              const isSoon = daysUntil <= 3 && daysUntil >= 0
              return (
                <div key={`${t.id}-${dueDate.toISOString()}`} className="flex items-center gap-3 py-1.5">
                  <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-xs shrink-0">
                    {cat?.icon ?? "📦"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{t.merchant}</p>
                    <p className={cn(
                      "text-[10px]",
                      isToday ? "text-destructive font-medium" :
                      isSoon  ? "text-amber-600" :
                                "text-muted-foreground"
                    )}>
                      {isToday
                        ? "Vence hoy"
                        : daysUntil === 1
                        ? "Mañana"
                        : `${format(dueDate, "d MMM", { locale: es })} · en ${daysUntil}d`}
                    </p>
                  </div>
                  <p className="text-xs font-semibold tabular-nums shrink-0">
                    {formatCurrency(t.total, t.currency)}
                  </p>
                </div>
              )
            })}
            {pendingItems.length > 3 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="w-full flex items-center justify-center gap-1 pt-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded
                  ? <><ChevronUp className="h-3 w-3" /> Ver menos</>
                  : <><ChevronDown className="h-3 w-3" /> Ver {pendingItems.length - 3} más</>}
              </button>
            )}
          </div>
        )}

        {/* Already paid summary */}
        {paidCount > 0 && (
          <p className="text-[10px] text-muted-foreground text-center border-t pt-2">
            {paidCount} recurrente{paidCount !== 1 ? "s" : ""} ya vencido{paidCount !== 1 ? "s" : ""} este mes
            · {formatCurrency(fixedThisMonth - pendingAmount)} comprometido
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
      <Skeleton className="h-52 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
