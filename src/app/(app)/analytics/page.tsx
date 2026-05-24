"use client"

import { useMemo, useState, useRef, useEffect, Suspense, lazy } from "react"
import { useQuery } from "@tanstack/react-query"
import { Timestamp } from "firebase/firestore"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "@/hooks/use-auth"
import { useUIStore } from "@/stores/ui-store"
import { useCategories } from "@/hooks/use-categories"
import { useGoals, useAddGoal, useUpdateGoalProgress, useDeleteGoal, type GoalInput } from "@/hooks/use-goals"
import { formatCurrency, percentChange, cn } from "@/lib/utils"
import { subMonths, format, startOfMonth, endOfMonth, getDate, getDaysInMonth, getDay, eachDayOfInterval } from "date-fns"
import { es } from "date-fns/locale"
import type { Expense } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { TrendingUp, TrendingDown, Minus, Plus, Trash2, Target, AlertTriangle, Check, FileDown, Loader2, BarChart2, Landmark, FileText } from "lucide-react"
import { haptic } from "@/lib/haptic"
import { exportMonthlyPDF } from "@/components/expenses/export-utils"
import { useUpdateUserSettings } from "@/hooks/use-user-settings"
import { ShareSummary } from "@/components/expenses/share-summary"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { FinancialHealth } from "@/components/analytics/financial-health"
import { ErrorBoundary }  from "@/components/ui/error-boundary"
import { AiMonthlySummary } from "@/components/analytics/ai-monthly-summary"
import { AiSuggestions } from "@/components/analytics/ai-suggestions"
import { TimeTravelSelector } from "@/components/analytics/time-travel-selector"

// Lazy-loaded — only mounted when their tab is selected
const CategoryTrend   = lazy(() => import("@/components/analytics/category-trend").then(m => ({ default: m.CategoryTrend })))
const YearComparison  = lazy(() => import("@/components/analytics/year-comparison").then(m => ({ default: m.YearComparison })))
const YearProjection  = lazy(() => import("@/components/analytics/year-projection").then(m => ({ default: m.YearProjection })))
const MonthlyPrediction = lazy(() => import("@/components/analytics/monthly-prediction").then(m => ({ default: m.MonthlyPrediction })))
const VATReport       = lazy(() => import("@/components/analytics/vat-report").then(m => ({ default: m.VATReport })))
const SankeyChart     = lazy(() => import("@/components/analytics/sankey-chart").then(m => ({ default: m.SankeyChart })))
const MerchantTracker = lazy(() => import("@/components/analytics/merchant-tracker").then(m => ({ default: m.MerchantTracker })))
// Finanzas tab
const PersonalPL       = lazy(() => import("@/components/analytics/personal-pl").then(m => ({ default: m.PersonalPL })))
const CitySpendingMap  = lazy(() => import("@/components/analytics/city-spending-map").then(m => ({ default: m.CitySpendingMap })))
const BudgetOptimizer  = lazy(() => import("@/components/analytics/budget-optimizer").then(m => ({ default: m.BudgetOptimizer })))
const CashFlowChart    = lazy(() => import("@/components/analytics/cash-flow-chart").then(m => ({ default: m.CashFlowChart })))
const AdvancedChart    = lazy(() => import("@/components/analytics/advanced-chart").then(m => ({ default: m.AdvancedChart })))
const SpendingTimeline = lazy(() => import("@/components/analytics/spending-timeline").then(m => ({ default: m.SpendingTimeline })))
const AskFinance       = lazy(() => import("@/components/analytics/ask-finance").then(m => ({ default: m.AskFinance })))
const ExpenseTypeGroups = lazy(() => import("@/components/analytics/expense-type-groups").then(m => ({ default: m.ExpenseTypeGroups })))
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Cell, LineChart, Line, Legend,
} from "recharts"
import { CURRENCIES } from "@/lib/constants"

// ─── Data hook — 6 months of expenses ─────────────────────────────────────────

function use6MonthExpenses() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["expenses-6m-analytics", user?.uid],
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // #5 — 5 min de cache para evitar refetches innecesarios
    queryFn: async () => {
      if (!user) return []
      const start = startOfMonth(subMonths(new Date(), 5))
      const res = await apiFetch(`/api/expenses?startDate=${start.toISOString()}&all=true`)
      if (!res.ok) return []
      const { expenses } = await res.json() as { expenses: Record<string, unknown>[] }
      return expenses.map(e => ({
        ...e,
        date: Timestamp.fromDate(new Date(e.date as string)),
      })) as unknown as Expense[]
    },
  })
}

// ─── Helper: get expenses for a given month offset (0 = current, 1 = prev…) ──
function expensesForMonth(all: Expense[], offset: number): Expense[] {
  const ref = subMonths(new Date(), offset)
  const start = startOfMonth(ref)
  const end = endOfMonth(ref)
  return all.filter((e) => {
    const d = e.date.toDate()
    return d >= start && d <= end
  })
}

// ─── Components ────────────────────────────────────────────────────────────────

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" /> 0%</span>
  const positive = value > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? "text-destructive" : "text-green-600"}`}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data: all6 = [], isLoading } = use6MonthExpenses()
  const { activeAccount } = useUIStore()
  const { user } = useAuth()

  const all = useMemo(() => {
    if (activeAccount === 'business') return all6.filter(e => e.account === 'business')
    return all6.filter(e => !e.account || e.account === 'personal')
  }, [all6, activeAccount])

  const { data: categories = [] } = useCategories()
  const updateSettings = useUpdateUserSettings()
  const { data: goals = [], isLoading: goalsLoading } = useGoals()
  const addGoal = useAddGoal()
  const updateProgress = useUpdateGoalProgress()
  const deleteGoal = useDeleteGoal()

  // 0 = current month, 1 = last month, …, 5 = 5 months ago
  const [selectedOffset, setSelectedOffset] = useState(0)

  // Time-travel analytics month (for the Resumen tab)
  const [analyticsMonth, setAnalyticsMonth] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  })

  const [activeTab, setActiveTab] = useState<"resumen" | "metas" | "finanzas" | "informes">("resumen")
  const [animatingTab, setAnimatingTab] = useState<string | null>(null)
  const prevTabRef = useRef(activeTab)

  // ── Swipe between tabs on touch devices ───────────────────────────────────
  const TABS_ORDER = ["resumen", "metas", "finanzas", "informes"] as const
  const tabSwipeStartX = useRef<number | null>(null)

  function onTabAreaTouchStart(e: React.TouchEvent) {
    tabSwipeStartX.current = e.touches[0].clientX
  }

  function onTabAreaTouchEnd(e: React.TouchEvent) {
    if (tabSwipeStartX.current === null) return
    const dx = e.changedTouches[0].clientX - tabSwipeStartX.current
    tabSwipeStartX.current = null
    if (Math.abs(dx) < 60) return
    const idx = TABS_ORDER.indexOf(activeTab)
    if (dx < -60 && idx < TABS_ORDER.length - 1) { haptic.light(); setActiveTab(TABS_ORDER[idx + 1]) }
    else if (dx > 60 && idx > 0) { haptic.light(); setActiveTab(TABS_ORDER[idx - 1]) }
  }
  useEffect(() => {
    if (prevTabRef.current === activeTab) return
    prevTabRef.current = activeTab
    setAnimatingTab(activeTab)
    const t = setTimeout(() => setAnimatingTab(null), 450)
    return () => clearTimeout(t)
  }, [activeTab])
  const [goalDialog, setGoalDialog] = useState(false)
  const [deleteGoalTarget, setDeleteGoalTarget] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [progressDialog, setProgressDialog] = useState<{ id: string; current: number; name: string } | null>(null)
  const [progressInput, setProgressInput] = useState("")
  const [goalForm, setGoalForm] = useState<GoalInput>({
    type: "saving", name: "", targetAmount: 0, currentAmount: 0, currency: "USD", deadline: null,
  })

  // Stable date — useMemo so it doesn't re-create every render and invalidate dependent memos
  const today = useMemo(() => new Date(), [])
  const dayOfMonth = getDate(today)
  const daysInMonth = getDaysInMonth(today)

  // Selected month and its comparison (one month earlier)
  const selected = useMemo(() => expensesForMonth(all, selectedOffset), [all, selectedOffset])
  const compared = useMemo(() => expensesForMonth(all, selectedOffset + 1), [all, selectedOffset])

  // #28 — Memoizar totales para evitar recalcular en cada render
  const selectedTotal = useMemo(() => selected.reduce((a, e) => a + e.total, 0), [selected])
  const comparedTotal = useMemo(() => compared.reduce((a, e) => a + e.total, 0), [compared])

  const selectedMonth = useMemo(() => subMonths(today, selectedOffset), [today, selectedOffset])
  const comparedMonth = useMemo(() => subMonths(today, selectedOffset + 1), [today, selectedOffset])

  // ── 6-month trend data (for the trend bar chart) ───────────────────────────
  const trendData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const offset = 5 - i // oldest first
      const monthDate = subMonths(today, offset)
      const monthExpenses = expensesForMonth(all, offset)
      return {
        month: format(monthDate, "MMM", { locale: es }),
        total: monthExpenses.reduce((a, e) => a + e.total, 0),
        offset,
        isSelected: offset === selectedOffset,
      }
    })
  }, [all, selectedOffset, today])

  // ── Cumulative day-by-day chart ────────────────────────────────────────────
  const cumulativeData = useMemo(() => {
    const selStart = startOfMonth(selectedMonth)
    const selEnd = endOfMonth(selectedMonth)
    const cmpStart = startOfMonth(comparedMonth)

    // Build daily totals for selected month
    const selByDay: Record<number, number> = {}
    selected.forEach((e) => {
      const day = getDate(e.date.toDate())
      selByDay[day] = (selByDay[day] ?? 0) + e.total
    })

    // Build daily totals for compared month
    const cmpByDay: Record<number, number> = {}
    compared.forEach((e) => {
      const day = getDate(e.date.toDate())
      cmpByDay[day] = (cmpByDay[day] ?? 0) + e.total
    })

    const days = getDaysInMonth(selectedMonth)
    let selCum = 0
    let cmpCum = 0
    return Array.from({ length: days }, (_, i) => {
      const day = i + 1
      selCum += selByDay[day] ?? 0
      cmpCum += cmpByDay[day] ?? 0
      // Only show future days of current month as undefined (no projection)
      const isFuture = selectedOffset === 0 && day > dayOfMonth
      return {
        day,
        [format(selectedMonth, "MMM", { locale: es })]: isFuture ? null : selCum,
        [format(comparedMonth, "MMM", { locale: es })]: cmpCum,
      }
    })
  }, [selected, compared, selectedMonth, comparedMonth, selectedOffset, dayOfMonth])

  // ── Category comparison ────────────────────────────────────────────────────
  const categoryComparison = useMemo(() => {
    const currMap: Record<string, { total: number; count: number }> = {}
    const prevMap: Record<string, { total: number; count: number }> = {}
    selected.forEach((e) => {
      if (!currMap[e.category]) currMap[e.category] = { total: 0, count: 0 }
      currMap[e.category].total += e.total
      currMap[e.category].count++
    })
    compared.forEach((e) => {
      if (!prevMap[e.category]) prevMap[e.category] = { total: 0, count: 0 }
      prevMap[e.category].total += e.total
      prevMap[e.category].count++
    })
    const allCats = new Set([...Object.keys(currMap), ...Object.keys(prevMap)])
    return [...allCats].map((id) => {
      const cat = categories.find((c) => c.id === id)
      const c = currMap[id] ?? { total: 0, count: 0 }
      const p = prevMap[id] ?? { total: 0, count: 0 }
      return {
        id, name: cat?.name ?? id, icon: cat?.icon ?? "📦", color: cat?.color ?? "#6b7280",
        current: c.total, currentCount: c.count,
        prev: p.total, prevCount: p.count,
        delta: percentChange(c.total, p.total),
      }
    }).sort((a, b) => b.current - a.current)
  }, [selected, compared, categories])

  // #28 — Memoizar chart data derivada de categoryComparison
  const comparisonChartData = useMemo(() => categoryComparison.slice(0, 8).map((c) => ({
    name: c.icon + " " + c.name.slice(0, 8),
    [format(selectedMonth, "MMM", { locale: es })]: c.current,
    [format(comparedMonth, "MMM", { locale: es })]: c.prev,
    color: c.color,
  })), [categoryComparison, selectedMonth, comparedMonth])

  const selLabel = format(selectedMonth, "MMM yyyy", { locale: es })
  const cmpLabel = format(comparedMonth, "MMM yyyy", { locale: es })

  // ── Daily limit (always uses current month) ───────────────────────────────
  const currentMonthExpenses = useMemo(() => expensesForMonth(all, 0), [all])
  const currentTotal = currentMonthExpenses.reduce((a, e) => a + e.total, 0)
  const dailyLimitGoal = goals.find((g) => g.type === "daily_limit" && g.isActive)
  const dailySpend = useMemo(() => {
    const todayStr = format(today, "yyyy-MM-dd")
    return currentMonthExpenses
      .filter((e) => format(e.date.toDate(), "yyyy-MM-dd") === todayStr)
      .reduce((a, e) => a + e.total, 0)
  }, [currentMonthExpenses, today])

  const dailyAvgThisMonth = currentTotal / Math.max(dayOfMonth, 1)
  const projectedMonthEnd = dailyAvgThisMonth * daysInMonth

  // ── Daily heatmap: spending per day for current month ─────────────────────
  const dailyHeatmap = useMemo(() => {
    const byDay: Record<number, number> = {}
    currentMonthExpenses.forEach((e) => {
      const day = getDate(e.date.toDate())
      byDay[day] = (byDay[day] ?? 0) + e.total
    })
    const limit = dailyLimitGoal?.targetAmount ?? null
    const firstDayOfWeek = new Date(today.getFullYear(), today.getMonth(), 1).getDay() // 0=Sun
    return { byDay, limit, firstDayOfWeek }
  }, [currentMonthExpenses, dailyLimitGoal, today])

  const daysOverLimit = useMemo(() => {
    if (!dailyLimitGoal) return 0
    return Object.values(dailyHeatmap.byDay).filter((v) => v > dailyLimitGoal.targetAmount).length
  }, [dailyHeatmap, dailyLimitGoal])

  // ── Weekly pattern: avg spend per day of the week (all 6 months) ─────────
  const weekdayData = useMemo(() => {
    // Labels starting Monday (index 0 = Mon … 6 = Sun)
    const LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    // date-fns getDay returns 0=Sun, 1=Mon … 6=Sat → remap to Mon-first
    const toMonFirst = (d: number) => (d + 6) % 7

    // Count how many times each weekday occurred across the 6-month window
    // (so we can compute a true average, not just total)
    const start = startOfMonth(subMonths(today, 5))
    const end = today // up to today only
    const allDays = eachDayOfInterval({ start, end })
    const dayOccurrences = new Array(7).fill(0)
    allDays.forEach((d) => { dayOccurrences[toMonFirst(getDay(d))]++ })

    // Accumulate totals and counts per weekday
    const totals = new Array(7).fill(0)
    const counts = new Array(7).fill(0)
    all.forEach((e) => {
      const d = e.date.toDate()
      const idx = toMonFirst(getDay(d))
      totals[idx] += e.total
      counts[idx]++
    })

    // Best day = highest avg spend (to highlight)
    const avgs = totals.map((t, i) => (dayOccurrences[i] > 0 ? t / dayOccurrences[i] : 0))
    const maxAvg = Math.max(...avgs)

    return LABELS.map((label, i) => ({
      label,
      avg: parseFloat(avgs[i].toFixed(2)),
      total: parseFloat(totals[i].toFixed(2)),
      count: counts[i],
      isMax: avgs[i] === maxAvg && maxAvg > 0,
    }))
  }, [all, today])

  // ── Saving goals ──────────────────────────────────────────────────────────
  const savingGoals = goals.filter((g) => g.type === "saving")

  async function handleAddGoal() {
    if (!goalForm.name || goalForm.targetAmount <= 0) {
      toast.error("Completa nombre y monto objetivo")
      return
    }
    try {
      await addGoal.mutateAsync(goalForm)
      toast.success("Meta creada")
      setGoalDialog(false)
      setGoalForm({ type: "saving", name: "", targetAmount: 0, currentAmount: 0, currency: "USD", deadline: null })
    } catch {
      toast.error("Error al crear meta")
    }
  }

  async function handleUpdateProgress() {
    if (!progressDialog) return
    const increment = parseFloat(progressInput)
    if (isNaN(increment) || increment < 0) { toast.error("Monto inválido"); return }
    const newAmount = progressDialog.current + increment
    try {
      await updateProgress.mutateAsync({ id: progressDialog.id, currentAmount: newAmount })
      toast.success("Progreso actualizado")
      setProgressDialog(null)
      setProgressInput("")
    } catch {
      toast.error("Error al actualizar")
    }
  }

  function handleDeleteGoal(id: string) {
    setDeleteGoalTarget(id)
  }

  async function confirmDeleteGoal() {
    if (!deleteGoalTarget) return
    try {
      await deleteGoal.mutateAsync(deleteGoalTarget)
      toast.success("Meta eliminada")
    } catch {
      toast.error("Error al eliminar")
    }
  }

  if (isLoading) return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-5">
      {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
    </div>
  )

  async function handleExportPDF() {
    if (selected.length === 0) { toast.info("No hay gastos en el mes seleccionado"); return }
    setPdfLoading(true)
    try {
      await exportMonthlyPDF(selected, categories, selectedMonth, comparedTotal, {
        userName: user?.displayName ?? user?.email ?? undefined,
        onSuccess: () => { void updateSettings.mutate({ hasExportedPDF: true }) },
      })
      toast.success("Reporte PDF descargado")
    } catch {
      toast.error("Error al generar el PDF")
    } finally {
      setPdfLoading(false)
    }
  }

  // ── Tab definitions ─────────────────────────────────────────────────────────
  const TABS = [
    { id: "resumen",  label: "Resumen",  Icon: BarChart2  },
    { id: "metas",    label: "Metas",    Icon: Target     },
    { id: "finanzas", label: "Finanzas", Icon: Landmark   },
    { id: "informes", label: "Informes", Icon: FileText   },
  ] as const

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-5">
      <ConfirmDialog
        open={!!deleteGoalTarget}
        onOpenChange={(o) => { if (!o) setDeleteGoalTarget(null) }}
        title="¿Eliminar esta meta?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={confirmDeleteGoal}
      />

      <FinancialHealth />

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-2xl">Análisis</h1>
          {activeAccount === 'business' && (
            <span className="text-[9px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">Negocio</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ShareSummary />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleExportPDF}
            disabled={pdfLoading || isLoading}
          >
            {pdfLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <FileDown className="h-3.5 w-3.5" />}
            PDF
          </Button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted">
        {TABS.map((t) => {
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => { haptic.light(); setActiveTab(t.id) }}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-semibold transition-all",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.Icon
                className={cn(
                  "h-3.5 w-3.5 transition-none",
                  isActive && "stroke-[2.5]",
                  animatingTab === t.id && "nav-icon-pop",
                )}
              />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab position dots (mobile only) ─────────────────────────────── */}
      <div className="flex justify-center gap-1.5 -mt-1 md:hidden" aria-hidden>
        {TABS_ORDER.map((t) => (
          <button
            key={t}
            onClick={() => { haptic.light(); setActiveTab(t) }}
            className={cn(
              "rounded-full transition-all duration-300",
              activeTab === t
                ? "h-1.5 w-4 bg-foreground"
                : "h-1.5 w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
            )}
          />
        ))}
      </div>

      {/* ════ Swipeable tab content area ════════════════════════════════════ */}
      {/* onTouchStart/End on mobile lets you swipe left/right to change tabs  */}
      <div
        onTouchStart={onTabAreaTouchStart}
        onTouchEnd={onTabAreaTouchEnd}
        className="space-y-5"
      >

      {/* ════════════════════ TAB: RESUMEN ════════════════════ */}
      {activeTab === "resumen" && (<>

      {/* ── Time travel selector ── */}
      <TimeTravelSelector
        year={analyticsMonth.year}
        month={analyticsMonth.month}
        onMonthChange={(y, m) => {
          setAnalyticsMonth({ year: y, month: m })
          const nowDate = new Date()
          const offset = (nowDate.getFullYear() - y) * 12 + (nowDate.getMonth() - m)
          if (offset >= 0 && offset <= 5) setSelectedOffset(offset)
        }}
      />

      {/* ── Empty state for selected period ── */}
      {selected.length === 0 && all6.length > 0 && (
        <div className="rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5 p-6 text-center space-y-2">
          <p className="text-xl">🔍</p>
          <p className="text-sm font-semibold">Sin datos con estos filtros</p>
          <p className="text-xs text-muted-foreground">No hay gastos para el período seleccionado</p>
          <Button variant="outline" size="sm" onClick={() => setSelectedOffset(0)}>Ver mes actual</Button>
        </div>
      )}
      {all6.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-card/50 p-8 text-center space-y-2">
          <p className="text-2xl">📊</p>
          <p className="text-sm font-semibold">Sin datos para este período</p>
          <p className="text-xs text-muted-foreground">Añade gastos para ver análisis detallados</p>
        </div>
      )}

      {/* ── Resumen IA del mes ── */}
      <AiMonthlySummary
        expenses={selected.map((e) => ({ total: e.total, merchant: e.merchant, category: e.category }))}
        categoryBreakdown={categoryComparison.map((c) => ({ name: c.name, total: c.current, delta: c.delta }))}
        month={selLabel}
      />

      {/* ── Sugerencias de ahorro con IA ── */}
      <AiSuggestions
        expenses3months={all.map((e) => ({ total: e.total, merchant: e.merchant, category: e.category }))}
      />

      {/* ── Tendencia 6 meses (clickable to select month) ── */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-medium">Tendencia — últimos 6 meses</CardTitle>
          <p className="text-[11px] text-muted-foreground">Toca un mes para compararlo con el anterior</p>
        </CardHeader>
        <CardContent className="px-2 pb-3">
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
              onClick={(d: any) => { if (d?.activePayload?.[0]) setSelectedOffset((d.activePayload[0].payload as typeof trendData[0]).offset) }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={30}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip
                formatter={(v) => formatCurrency(Number(v))}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]} cursor="pointer">
                {trendData.map((entry) => (
                  <Cell
                    key={entry.offset}
                    fillOpacity={entry.isSelected ? 1 : 0.35}
                    fill="hsl(var(--foreground))"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Comparativa mes seleccionado vs anterior ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm font-medium capitalize">{selLabel} vs {cmpLabel}</CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{formatCurrency(selectedTotal)}</span> vs {formatCurrency(comparedTotal)}
                </span>
                <DeltaBadge value={percentChange(selectedTotal, comparedTotal)} />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 space-y-0">
          {/* Cumulative spending curve */}
          <div className="px-2 pt-1 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-2 mb-1">Gasto acumulado por día</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={cumulativeData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 9 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v % 5 === 0 || v === 1 ? String(v) : ""} />
                <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={30}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip
                  formatter={(v) => formatCurrency(Number(v))}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                <Line
                  type="monotone"
                  dataKey={format(comparedMonth, "MMM", { locale: es })}
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey={format(selectedMonth, "MMM", { locale: es })}
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Category bar chart */}
          {comparisonChartData.length > 0 && (
            <div className="px-2 pb-2 border-t pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-2 mb-1">Por categoría</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={comparisonChartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={30}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v))}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                  />
                  <Bar dataKey={format(comparedMonth, "MMM", { locale: es })} radius={[3, 3, 0, 0]} fillOpacity={0.3} fill="hsl(var(--foreground))" />
                  <Bar dataKey={format(selectedMonth, "MMM", { locale: es })} radius={[3, 3, 0, 0]} fillOpacity={0.85} fill="hsl(var(--foreground))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Comparison table */}
          <table className="w-full text-sm border-t">
            <thead>
              <tr className="border-b">
                <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-4 py-2">Categoría</th>
                <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-2 py-2 capitalize">{format(comparedMonth, "MMM", { locale: es })}</th>
                <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-2 py-2 capitalize">{format(selectedMonth, "MMM", { locale: es })}</th>
                <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-4 py-2">Δ</th>
              </tr>
            </thead>
            <tbody>
              {categoryComparison.map((cat, i) => (
                <tr key={cat.id} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                      <span className="text-xs">{cat.icon}</span>
                      <span className="text-xs font-medium truncate max-w-[90px]">{cat.name}</span>
                    </div>
                  </td>
                  <td className="text-right px-2 py-2 tabular-nums text-xs text-muted-foreground">{cat.prev > 0 ? formatCurrency(cat.prev) : "—"}</td>
                  <td className="text-right px-2 py-2 tabular-nums text-xs font-semibold">{cat.current > 0 ? formatCurrency(cat.current) : "—"}</td>
                  <td className="text-right px-4 py-2">
                    {cat.prev > 0 || cat.current > 0 ? <DeltaBadge value={cat.delta} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30">
                <td className="px-4 py-2 text-xs font-semibold">Total</td>
                <td className="text-right px-2 py-2 tabular-nums text-xs text-muted-foreground">{formatCurrency(comparedTotal)}</td>
                <td className="text-right px-2 py-2 tabular-nums text-xs font-bold">{formatCurrency(selectedTotal)}</td>
                <td className="text-right px-4 py-2"><DeltaBadge value={percentChange(selectedTotal, comparedTotal)} /></td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* ── #10 Gasto diario (heatmap) ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">Gasto diario</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(today, "MMMM yyyy", { locale: es })}
              </p>
            </div>
            {!dailyLimitGoal ? (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => { setGoalForm({ type: "daily_limit", name: "Límite diario", targetAmount: 50, currentAmount: 0, currency: "USD", deadline: null }); setGoalDialog(true) }}>
                <Plus className="h-3 w-3" /> Configurar límite
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Límite: {formatCurrency(dailyLimitGoal.targetAmount)}/día</span>
                <button onClick={() => handleDeleteGoal(dailyLimitGoal.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Hoy</p>
              <p className={`tabular-nums text-lg font-bold mt-0.5 ${dailyLimitGoal && dailySpend >= dailyLimitGoal.targetAmount ? "text-destructive" : ""}`}>
                {formatCurrency(dailySpend)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Promedio/día</p>
              <p className="tabular-nums text-lg font-bold mt-0.5">{formatCurrency(dailyAvgThisMonth)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Proyectado</p>
              <p className="tabular-nums text-lg font-bold mt-0.5">{formatCurrency(projectedMonthEnd)}</p>
            </div>
          </div>

          {/* Today's progress bar */}
          {dailyLimitGoal && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {dailySpend >= dailyLimitGoal.targetAmount
                    ? <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    : <Check className="h-3.5 w-3.5 text-green-600" />}
                  <span className="text-xs font-medium">
                    {dailySpend >= dailyLimitGoal.targetAmount
                      ? `Superado por ${formatCurrency(dailySpend - dailyLimitGoal.targetAmount)}`
                      : `${formatCurrency(Math.max(dailyLimitGoal.targetAmount - dailySpend, 0))} disponible hoy`}
                  </span>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {Math.round((dailySpend / dailyLimitGoal.targetAmount) * 100)}%
                </span>
              </div>
              <Progress
                value={Math.min((dailySpend / dailyLimitGoal.targetAmount) * 100, 100)}
                className="h-1.5"
              />
            </div>
          )}

          {/* Calendar heatmap */}
          <div className="space-y-2">
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 gap-0.5">
              {["D", "L", "M", "X", "J", "V", "S"].map((d) => (
                <div key={d} className="text-center text-[11px] text-muted-foreground font-medium py-0.5">{d}</div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {/* Empty cells for days before the 1st */}
              {Array.from({ length: dailyHeatmap.firstDayOfWeek }, (_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {/* Day cells */}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1
                const spend = dailyHeatmap.byDay[day] ?? 0
                const isFuture = day > dayOfMonth
                const isToday = day === dayOfMonth
                const isOver = dailyLimitGoal && spend > dailyLimitGoal.targetAmount
                const hasSpend = spend > 0

                let cellClass = "rounded aspect-square flex items-center justify-center text-[11px] font-medium relative group cursor-default"
                if (isFuture) {
                  cellClass += " bg-muted/30 text-muted-foreground/40"
                } else if (isOver) {
                  cellClass += " bg-destructive/20 text-destructive font-semibold"
                } else if (hasSpend) {
                  cellClass += " bg-green-500/20 text-green-700 dark:text-green-400"
                } else {
                  cellClass += " bg-muted/50 text-muted-foreground/60"
                }
                if (isToday) {
                  cellClass += " ring-2 ring-primary ring-offset-1"
                }

                return (
                  <div key={day} className={cellClass} title={spend > 0 ? formatCurrency(spend) : undefined}>
                    {day}
                    {/* Tooltip on hover */}
                    {!isFuture && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                        <div className="bg-popover border rounded px-2 py-1 text-xs shadow-md whitespace-nowrap">
                          <span className="font-semibold">{formatCurrency(spend)}</span>
                          {dailyLimitGoal && (
                            <span className={`ml-1 ${isOver ? "text-destructive" : "text-green-600"}`}>
                              {isOver ? "▲" : "✓"}
                            </span>
                          )}
                        </div>
                        <div className="w-1.5 h-1.5 bg-popover border-b border-r rotate-45 -mt-1" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Monthly summary when limit is set */}
          {dailyLimitGoal && (
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
              <div className="flex items-center gap-1.5">
                {daysOverLimit === 0
                  ? <Check className="h-3.5 w-3.5 text-green-600" />
                  : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                <span className="text-xs font-medium">
                  {daysOverLimit === 0
                    ? "Sin días sobre el límite este mes"
                    : `${daysOverLimit} día${daysOverLimit !== 1 ? "s" : ""} sobre el límite`}
                </span>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                de {dayOfMonth} registrados
              </span>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-green-500/20" />
              <span>Bajo el límite</span>
            </div>
            {dailyLimitGoal && (
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded bg-destructive/20" />
                <span>Sobre el límite</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-muted/50" />
              <span>Sin gasto</span>
            </div>
          </div>
        </CardContent>
      </Card>

      </>)} {/* END TAB: RESUMEN */}

      {/* ════════════════════ TAB: METAS ════════════════════ */}
      {activeTab === "metas" && (<>

      {/* ── #13 Metas de ahorro ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Metas de ahorro</CardTitle>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
              onClick={() => { setGoalForm({ type: "saving", name: "", targetAmount: 0, currentAmount: 0, currency: "USD", deadline: null }); setGoalDialog(true) }}>
              <Plus className="h-3 w-3" /> Nueva meta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {goalsLoading ? (
            <Skeleton className="h-20 rounded-lg" />
          ) : savingGoals.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground space-y-3">
              <Target className="h-8 w-8 mx-auto opacity-30" />
              <div>
                <p className="text-sm">Sin metas de ahorro todavía</p>
                <p className="text-xs mt-1">Define cuánto quieres ahorrar y lleva el control</p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5"
                onClick={() => { setGoalForm({ type: "saving", name: "", targetAmount: 0, currentAmount: 0, currency: "USD", deadline: null }); setGoalDialog(true) }}>
                <Plus className="h-3.5 w-3.5" /> Crear primera meta
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {savingGoals.map((goal) => {
                const pct = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0
                const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0)
                const completed = goal.currentAmount >= goal.targetAmount
                const daysLeft = goal.deadline
                  ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86_400_000)
                  : null
                return (
                  <div key={goal.id} className="space-y-2 p-3 rounded-xl border bg-muted/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {completed && <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                          <p className="text-sm font-medium truncate">{goal.name}</p>
                        </div>
                        {goal.deadline && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {daysLeft !== null && daysLeft > 0
                              ? `${daysLeft} días restantes · ${format(new Date(goal.deadline), "dd MMM yyyy", { locale: es })}`
                              : daysLeft === 0 ? "Vence hoy" : "Vencida"}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => { setProgressDialog({ id: goal.id, current: goal.currentAmount, name: goal.name }); setProgressInput("") }}
                          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:border-foreground/30 transition-colors"
                        >
                          Actualizar
                        </button>
                        <button onClick={() => handleDeleteGoal(goal.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <div className="flex items-center justify-between text-xs tabular-nums">
                      <span className="font-semibold">{formatCurrency(goal.currentAmount, goal.currency)}</span>
                      <span className="text-muted-foreground">
                        {completed ? "¡Meta alcanzada! 🎉" : `${formatCurrency(remaining, goal.currency)} restante`}
                      </span>
                      <span className="text-muted-foreground">{formatCurrency(goal.targetAmount, goal.currency)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      </>)} {/* END TAB: METAS */}

      {/* ════════════════════ TAB: INFORMES ════════════════════ */}
      {/* Components are lazy-loaded — only bundled/fetched when this tab is opened */}
      {activeTab === "informes" && (<>

      {/* ── #6 Patrón por día de la semana ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Patrón semanal de gasto</CardTitle>
          <p className="text-xs text-muted-foreground">Promedio diario · últimos 6 meses</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="h-40 flex items-end gap-1.5 px-1">
              {[60, 40, 75, 55, 90, 35, 20].map((h, i) => (
                <div key={i} className="flex-1 bg-muted animate-pulse rounded-t" style={{ height: `${h}%` }} />
              ))}
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={weekdayData} barCategoryGap="20%">
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--accent))", radius: 4 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="rounded-lg border bg-popover p-2.5 shadow-md text-xs space-y-0.5">
                          <p className="font-semibold">{d.label}</p>
                          <p className="tabular-nums">Promedio: <span className="font-medium">{formatCurrency(d.avg)}</span></p>
                          <p className="tabular-nums text-muted-foreground">Total: {formatCurrency(d.total)}</p>
                          <p className="text-muted-foreground">{d.count} transacciones</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                    {weekdayData.map((entry, i) => (
                      <Cell key={i} fill={entry.isMax ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.25)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {weekdayData.some((d) => d.avg > 0) && (() => {
                const sorted = [...weekdayData].filter((d) => d.avg > 0).sort((a, b) => b.avg - a.avg)
                const busiest = sorted[0]
                const quietest = sorted[sorted.length - 1]
                return (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t">
                    <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">Día más activo</p>
                      <p className="text-sm font-bold mt-0.5">{busiest.label}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(busiest.avg)} promedio</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">Día más tranquilo</p>
                      <p className="text-sm font-bold mt-0.5">{quietest.label}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(quietest.avg)} promedio</p>
                    </div>
                  </div>
                )
              })()}
            </>
          )}
        </CardContent>
      </Card>

      <Suspense fallback={
          <div className="space-y-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
          </div>
        }>
          <div className="space-y-4">
            <ErrorBoundary label="Comparativa anual">
              <YearComparison />
            </ErrorBoundary>
            <ErrorBoundary label="Proyección del año">
              <YearProjection />
            </ErrorBoundary>
            <ErrorBoundary label="Predicción mensual">
              <MonthlyPrediction />
            </ErrorBoundary>
            <ErrorBoundary label="Informe de IVA">
              <VATReport />
            </ErrorBoundary>
            <ErrorBoundary label="Diagrama Sankey">
              <SankeyChart />
            </ErrorBoundary>
            <ErrorBoundary label="Seguimiento de comercios">
              <MerchantTracker />
            </ErrorBoundary>
            <ErrorBoundary label="Tendencia por categoría">
              <CategoryTrend />
            </ErrorBoundary>
          </div>
        </Suspense>
      </>)}

      {/* ════════════════════ TAB: FINANZAS ════════════════════ */}
      {activeTab === "finanzas" && (
        <Suspense fallback={
          <div className="space-y-4">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
          </div>
        }>
          <div className="space-y-4">
            <ErrorBoundary label="Estado de resultados P&L">
              <PersonalPL />
            </ErrorBoundary>
            <ErrorBoundary label="Mapa de gasto por ciudad">
              <CitySpendingMap expenses={all} />
            </ErrorBoundary>
            <ErrorBoundary label="Optimizador de presupuesto">
              <BudgetOptimizer expenses={selected} />
            </ErrorBoundary>
            <ErrorBoundary label="Flujo de caja">
              <CashFlowChart />
            </ErrorBoundary>
            <ErrorBoundary label="Gráfico avanzado">
              <AdvancedChart expenses={all} />
            </ErrorBoundary>
            <ErrorBoundary label="Timeline de gastos">
              <SpendingTimeline expenses={all} days={30} />
            </ErrorBoundary>
            <ErrorBoundary label="Grupos por tipo de gasto">
              <ExpenseTypeGroups expenses={all} categories={categories} />
            </ErrorBoundary>
            <ErrorBoundary label="Consultas financieras con IA">
              <AskFinance
                context={{
                  monthTotal: selectedTotal,
                  prevMonthTotal: comparedTotal,
                  topCategories: categoryComparison.slice(0, 5).map((c) => ({ name: c.name, total: c.current })),
                  savingsRate: undefined,
                }}
              />
            </ErrorBoundary>
          </div>
        </Suspense>
      )}

      </div>{/* /swipeable tab content */}

      {/* ── Dialogs — montados solo cuando están abiertos para ahorrar memoria ── */}

      {/* ── Dialog nueva meta / límite ── */}
      {goalDialog && <Dialog open onOpenChange={setGoalDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {goalForm.type === "saving" ? "Nueva meta de ahorro" : "Configurar límite diario"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            {goalForm.type === "saving" && (
              <div className="space-y-1.5">
                <Label>Nombre de la meta</Label>
                <Input
                  placeholder="Ej. Vacaciones, Laptop, Fondo de emergencia..."
                  value={goalForm.name}
                  onChange={(e) => setGoalForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{goalForm.type === "saving" ? "Monto objetivo" : "Límite por día"}</Label>
                <Input
                  type="number" inputMode="decimal" step="0.01" min="0"
                  value={goalForm.targetAmount || ""}
                  onChange={(e) => setGoalForm((f) => ({ ...f, targetAmount: parseFloat(e.target.value) || 0 }))}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <Select value={goalForm.currency} onValueChange={(v) => setGoalForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {goalForm.type === "saving" && (
              <>
                <div className="space-y-1.5">
                  <Label>Ahorro inicial (opcional)</Label>
                  <Input
                    type="number" inputMode="decimal" step="0.01" min="0"
                    value={goalForm.currentAmount || ""}
                    onChange={(e) => setGoalForm((f) => ({ ...f, currentAmount: parseFloat(e.target.value) || 0 }))}
                    className="tabular-nums" placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha límite (opcional)</Label>
                  <Input
                    type="date"
                    value={goalForm.deadline ?? ""}
                    onChange={(e) => setGoalForm((f) => ({ ...f, deadline: e.target.value || null }))}
                  />
                </div>
              </>
            )}
            <Button className="w-full" onClick={handleAddGoal} disabled={addGoal.isPending}>
              {goalForm.type === "saving" ? "Crear meta" : "Guardar límite"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>}

      {/* ── Dialog actualizar progreso ── */}
      {!!progressDialog && <Dialog open onOpenChange={(o) => !o && setProgressDialog(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Aportar a "{progressDialog?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            {/* Current balance read-only */}
            <div className="rounded-lg bg-muted/50 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Ahorrado hasta ahora</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(progressDialog?.current ?? 0)}
              </span>
            </div>
            {/* Increment input */}
            <div className="space-y-1.5">
              <Label>Cantidad a añadir</Label>
              <Input
                type="number" inputMode="decimal" step="0.01" min="0"
                value={progressInput}
                onChange={(e) => setProgressInput(e.target.value)}
                className="tabular-nums text-lg"
                placeholder="0.00"
                autoFocus
              />
            </div>
            {/* Live preview */}
            {progressInput && !isNaN(parseFloat(progressInput)) && parseFloat(progressInput) > 0 && (
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2 flex items-center justify-between animate-[fadeSlideUp_0.2s_ease_both]">
                <span className="text-xs text-muted-foreground">Nuevo total</span>
                <div className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-green-700 dark:text-green-400">
                  <span className="text-muted-foreground font-normal text-xs">
                    {formatCurrency(progressDialog?.current ?? 0)} + {formatCurrency(parseFloat(progressInput))} =
                  </span>
                  {formatCurrency((progressDialog?.current ?? 0) + parseFloat(progressInput))}
                </div>
              </div>
            )}
            <Button className="w-full" onClick={handleUpdateProgress} disabled={updateProgress.isPending || !progressInput || parseFloat(progressInput) <= 0}>
              {updateProgress.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Añadir aporte"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>}
    </div>
  )
}
