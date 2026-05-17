"use client"

import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import {
  isToday, isYesterday, format,
  startOfDay, endOfDay, subDays,
} from "date-fns"
import { es } from "date-fns/locale"
import { Pencil, ArrowRight, Receipt, Bookmark, BookmarkCheck } from "lucide-react"
import { useExpensesPeriod, useFlagExpense } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { useUIStore } from "@/stores/ui-store"
import { formatCurrency, cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { rankExpenses, type ScoredExpense } from "@/lib/smart-feed"
import type { Expense } from "@/types"
import { toast } from "sonner"

type FeedMode = "recent" | "smart"

function expDate(e: Expense): Date {
  return (e.date as { toDate(): Date }).toDate()
}

function relativeLabel(d: Date): string {
  if (isToday(d))     return `Hoy · ${format(d, "HH:mm")}`
  if (isYesterday(d)) return "Ayer"
  return format(d, "d MMM", { locale: es })
}

// ── Group expenses by day ─────────────────────────────────────────────────────

interface DayGroup {
  label: string
  dateKey: string
  isToday: boolean
  total: number
  expenses: Expense[]
}

function groupByDay(expenses: Expense[]): DayGroup[] {
  const map = new Map<string, DayGroup>()

  expenses.forEach(e => {
    const d = expDate(e)
    const key = format(d, "yyyy-MM-dd")
    if (!map.has(key)) {
      map.set(key, {
        label: isToday(d) ? "Hoy" : isYesterday(d) ? "Ayer" : format(d, "EEEE d MMM", { locale: es }),
        dateKey: key,
        isToday: isToday(d),
        total: 0,
        expenses: [],
      })
    }
    const group = map.get(key)!
    group.total += e.total
    group.expenses.push(e)
  })

  return Array.from(map.values()).slice(0, 5) // last 5 days
}

// ── Feed mode / filter persistence ───────────────────────────────────────────

function useFeedMode(): [FeedMode, (m: FeedMode) => void] {
  const [mode, setModeState] = useState<FeedMode>("recent")
  useEffect(() => {
    try {
      const saved = localStorage.getItem("rbt_feed_mode") as FeedMode | null
      if (saved === "smart" || saved === "recent") setModeState(saved)
    } catch { /* ignore */ }
  }, [])
  function setMode(m: FeedMode) {
    setModeState(m)
    try { localStorage.setItem("rbt_feed_mode", m) } catch { /* ignore */ }
  }
  return [mode, setMode]
}

function useFeedFilter(defaultVal = "todos"): [string, (v: string) => void] {
  const [filter, setFilterState] = useState(defaultVal)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("rbt_feed_filter")
      if (saved) setFilterState(saved)
    } catch { /* ignore */ }
  }, [])
  function setFilter(v: string) {
    setFilterState(v)
    try { localStorage.setItem("rbt_feed_filter", v) } catch { /* ignore */ }
  }
  return [filter, setFilter]
}

export function ActivityFeed() {
  const now = useMemo(() => new Date(), [])
  const start14 = useMemo(() => subDays(startOfDay(now), 13), [now])
  const { data: expenses = [], isLoading } = useExpensesPeriod(start14, endOfDay(now))
  const { data: categories = [] } = useCategories()
  const { setEditExpense, activeAccount } = useUIStore()
  const flagExpense = useFlagExpense()
  const [feedMode, setFeedMode] = useFeedMode()
  const [selectedCategory, setSelectedCategory] = useFeedFilter("todos")

  const filtered = useMemo(() =>
    expenses.filter(e =>
      !e.archived && (
        activeAccount === "business" ? e.account === "business" : !e.account || e.account === "personal"
      )
    ), [expenses, activeAccount]
  )

  // Categories that appear in recent expenses (for filter pills)
  const recentCategories = useMemo(() => {
    const ids = new Set(filtered.map((e) => e.category))
    return categories.filter((c) => ids.has(c.id))
  }, [filtered, categories])

  // Apply category filter
  const categoryFiltered = useMemo(() =>
    selectedCategory === "todos"
      ? filtered
      : filtered.filter((e) => e.category === selectedCategory),
    [filtered, selectedCategory]
  )

  // Daily average for smart ranking
  const dailyAvg = useMemo(() => {
    if (filtered.length === 0) return 0
    const total = filtered.reduce((s, e) => s + e.total, 0)
    return total / 14
  }, [filtered])

  // Known merchants (for smart ranking — "new merchant" detection)
  const knownMerchants = useMemo(() => {
    return new Set(filtered.map((e) => e.merchant.trim().toLowerCase()))
  }, [filtered])

  // Smart-ranked expenses
  const smartExpenses = useMemo(() => {
    if (feedMode !== "smart") return []
    return rankExpenses(categoryFiltered, dailyAvg, knownMerchants)
  }, [feedMode, categoryFiltered, dailyAvg, knownMerchants])

  const groups = useMemo(() => groupByDay(categoryFiltered), [categoryFiltered])

  if (isLoading) return <Skeleton className="h-48 rounded-2xl" />
  if (filtered.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-card/50 p-8 text-center space-y-2">
        <p className="text-2xl">✅</p>
        <p className="text-sm font-semibold">Sin movimientos recientes</p>
        <p className="text-xs text-muted-foreground">Añade tu primer gasto para verlo aquí</p>
      </div>
    )
  }

  async function handleFlag(e: Expense) {
    const newFlagged = !e.flagged
    await flagExpense.mutateAsync({ id: e.id, flagged: newFlagged })
    toast.success(newFlagged ? "Marcado como pendiente" : "Pendiente resuelto")
  }

  function renderExpenseRow(e: Expense | ScoredExpense, showSmartBadge = false) {
    const catMeta = categories.find(c => c.id === (e.category ?? "otros"))
    const emoji = catMeta?.icon ?? "📦"
    const catName = catMeta?.name ?? (e.category ?? "Otros")
    const score = (e as ScoredExpense)._score

    return (
      <div
        key={e.id}
        className="flex items-center gap-3 px-4 py-2.5 group hover:bg-accent/30 transition-colors"
      >
        <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center shrink-0 text-sm">
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-sm font-semibold truncate leading-tight">{e.merchant}</p>
            {e.privacy === "group" && <span className="text-[10px] shrink-0" title="Compartido con grupo">👥</span>}
            {e.recurringId && <span className="text-[10px] shrink-0 px-1 py-0.5 rounded-full bg-primary/10 text-primary" title="Gasto recurrente">🔄</span>}
            {showSmartBadge && score > 40 && (
              <span className="text-[10px] shrink-0" title="Sugerido por IA">✨</span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">{catName}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold tabular-nums text-destructive">
            -{formatCurrency(e.total, e.currency)}
          </p>
          <p className="text-[10px] text-muted-foreground">{relativeLabel(expDate(e))}</p>
        </div>
        {/* Flag button */}
        <button
          onClick={() => handleFlag(e)}
          className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center transition-all shrink-0",
            e.flagged
              ? "text-amber-500 opacity-100"
              : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-amber-500 hover:bg-muted"
          )}
          aria-label={e.flagged ? "Quitar pendiente" : "Marcar como pendiente"}
        >
          {e.flagged
            ? <BookmarkCheck className="h-3.5 w-3.5" />
            : <Bookmark className="h-3.5 w-3.5" />}
        </button>
        {/* Edit button */}
        <button
          onClick={() => setEditExpense(e)}
          className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0"
          aria-label="Editar gasto"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Actividad</p>
          <p className="text-sm font-bold mt-0.5">Últimos movimientos</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Feed mode toggle (Feature D) */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg border bg-muted/50 text-xs">
            <button
              onClick={() => setFeedMode("recent")}
              className={cn(
                "px-2 py-1 rounded-md font-medium transition-colors",
                feedMode === "recent"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              📋
            </button>
            <button
              onClick={() => setFeedMode("smart")}
              className={cn(
                "px-2 py-1 rounded-md font-medium transition-colors",
                feedMode === "smart"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              ✨
            </button>
          </div>
          <Link
            href="/expenses"
            className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
          >
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Category filter pills (Feature K) */}
      {recentCategories.length > 1 && (
        <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto scrollbar-none border-b border-border/40">
          <button
            onClick={() => setSelectedCategory("todos")}
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
              selectedCategory === "todos"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            Todos
          </button>
          {recentCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors flex items-center gap-1",
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Smart mode: flat ranked list */}
      {feedMode === "smart" && (
        <div>
          <div className="px-4 py-1.5 bg-amber-500/5 border-b border-amber-500/10">
            <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
              ✨ Modo inteligente — gastos relevantes primero
            </p>
          </div>
          <div className="divide-y divide-border/20">
            {smartExpenses.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Sin gastos recientes</p>
            ) : (
              smartExpenses.map((e) => renderExpenseRow(e, true))
            )}
          </div>
        </div>
      )}

      {/* Recent mode: day groups */}
      {feedMode === "recent" && (
        <div className="divide-y divide-border/40">
          {groups.map(group => (
            <div key={group.dateKey}>
              {/* Day header */}
              <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
                <p className={cn(
                  "text-[10px] font-semibold capitalize",
                  group.isToday ? "text-primary" : "text-muted-foreground"
                )}>
                  {group.label}
                </p>
                <p className="text-[10px] font-bold tabular-nums text-muted-foreground">
                  {formatCurrency(group.total)}
                </p>
              </div>

              {/* Expenses */}
              <div className="divide-y divide-border/20">
                {group.expenses.slice(0, 4).map((e) => renderExpenseRow(e, false))}
              </div>
            </div>
          ))}

          {categoryFiltered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              Sin gastos en esta categoría
            </p>
          )}
        </div>
      )}

      {/* Footer link */}
      <div className="px-4 py-3 border-t border-border/60 bg-muted/20">
        <Link
          href="/expenses"
          className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <Receipt className="h-3.5 w-3.5" />
          Ver historial completo de gastos
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
