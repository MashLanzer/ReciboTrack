"use client"

import { useMemo } from "react"
import Link from "next/link"
import { startOfMonth, endOfMonth } from "date-fns"
import { ArrowRight } from "lucide-react"
import { useExpenses } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { useUIStore } from "@/stores/ui-store"
import { useStarred, useToggleStarCategory } from "@/hooks/use-starred"
import { StarButton } from "@/components/ui/star-button"
import { formatCurrency, cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import type { Expense } from "@/types"

// ── Colour palette for categories ────────────────────────────────────────────

const PALETTE = [
  "bg-primary",
  "bg-violet-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-rose-500",
]

const PALETTE_LIGHT = [
  "bg-primary/12 text-primary",
  "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  "bg-rose-500/12 text-rose-600 dark:text-rose-400",
]

export function TopCategoriesCard() {
  const now = new Date()
  const { activeAccount } = useUIStore()
  const { data: starred } = useStarred()
  const toggleStar = useToggleStarCategory()
  const { data: result, isLoading: expLoading } = useExpenses({
    startDate: startOfMonth(now),
    endDate: endOfMonth(now),
    sort: "date_desc",
    account: activeAccount,
  })
  const { data: categories = [], isLoading: catLoading } = useCategories()

  const expenses: Expense[] = result?.expenses ?? []

  const topCats = useMemo(() => {
    const byCategory: Record<string, number> = {}
    expenses.forEach(e => {
      const cat = e.category ?? "otros"
      byCategory[cat] = (byCategory[cat] ?? 0) + e.total
    })

    const total = Object.values(byCategory).reduce((s, v) => s + v, 0)
    if (total === 0) return []

    return Object.entries(byCategory)
      .map(([cat, amount]) => {
        const meta = categories.find(c => c.id === cat)
        return {
          id: cat,
          label: meta?.name ?? cat,
          icon: meta?.icon ?? "📦",
          amount,
          pct: (amount / total) * 100,
        }
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  }, [expenses, categories])

  if (expLoading || catLoading) return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3.5 w-14" />
      </div>
      <div className="divide-y divide-border/30">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5" style={{ width: `${50 + i * 10}%` }} />
                <Skeleton className="h-3.5 w-14" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
  if (topCats.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-card/50 p-8 text-center space-y-2">
        <p className="text-2xl">📊</p>
        <p className="text-sm font-semibold">Sin gastos este mes</p>
        <p className="text-xs text-muted-foreground">Añade gastos para ver el análisis por categorías</p>
      </div>
    )
  }

  const maxAmount = topCats[0].amount
  const starredCats = starred?.categories ?? []

  return (
    <div className="card-lift rounded-2xl border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Top categorías</p>
          <p className="text-sm font-bold mt-0.5">Este mes</p>
        </div>
        <Link
          href="/expenses"
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Ver todas <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Category rows */}
      <div className="space-y-3">
        {topCats.map((cat, i) => {
          const isStarred = starredCats.includes(cat.id)
          return (
          <div key={cat.id} className="group space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={cn(
                "h-6 w-6 rounded-lg text-xs flex items-center justify-center shrink-0",
                PALETTE_LIGHT[i % PALETTE_LIGHT.length]
              )}>
                {cat.icon}
              </span>
              <span className="text-xs font-semibold flex-1 truncate">
                {cat.label}
                {isStarred && <span className="ml-1 text-amber-500">⭐</span>}
              </span>
              <span className={cn("transition-opacity", !isStarred && "opacity-0 group-hover:opacity-40")}>
                <StarButton
                  isStarred={isStarred}
                  onToggle={() => toggleStar.mutate({ categoryId: cat.id, isStarred })}
                  size="sm"
                />
              </span>
              <span className="text-xs tabular-nums font-bold shrink-0">{formatCurrency(cat.amount)}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 w-8 text-right">
                {cat.pct.toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden ml-8">
              <div
                className={cn("h-full rounded-full transition-all duration-700", PALETTE[i % PALETTE.length])}
                style={{ width: `${(cat.amount / maxAmount) * 100}%` }}
              />
            </div>
          </div>
          )
        })}
      </div>
    </div>
  )
}
