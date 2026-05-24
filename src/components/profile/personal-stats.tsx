"use client"

// #32 — Extraído de profile/page.tsx para reducir el bundle inicial del perfil.
// Tiene sus propios hooks y no necesita props del componente padre.

import { useMemo } from "react"
import { useExpensesPeriod } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { formatCurrency } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { format, startOfYear, endOfYear, getMonth, getDay } from "date-fns"
import { es } from "date-fns/locale"
import { Tag, Calendar, Store, TrendingDown } from "lucide-react"
import type { Expense } from "@/types"

export function PersonalStats() {
  const now = new Date()
  const yearStart = startOfYear(now)
  const yearEnd = endOfYear(now)
  const { data: yearExpenses = [], isLoading } = useExpensesPeriod(yearStart, yearEnd)
  const { data: categories = [] } = useCategories()

  const stats = useMemo(() => {
    if (!yearExpenses.length) return null
    const expDate = (e: Expense) => (e.date as { toDate(): Date }).toDate()
    const totalYear = yearExpenses.reduce((s, e) => s + e.total, 0)

    const byCategory = new Map<string, number>()
    yearExpenses.forEach(e => byCategory.set(e.category ?? "otros", (byCategory.get(e.category ?? "otros") ?? 0) + e.total))
    const topCatId = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const topCat = categories.find(c => c.id === topCatId)
    const topCatLabel = topCat ? `${topCat.icon} ${topCat.name}` : topCatId ?? "—"

    const byMerchant = new Map<string, number>()
    yearExpenses.forEach(e => {
      const k = e.merchant.trim().toLowerCase()
      byMerchant.set(k, (byMerchant.get(k) ?? 0) + 1)
    })
    const topMerchantKey = [...byMerchant.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const topMerchantCount = byMerchant.get(topMerchantKey ?? "") ?? 0
    const topMerchantName = yearExpenses.find(e => e.merchant.trim().toLowerCase() === topMerchantKey)?.merchant ?? "—"

    const byMonth = new Map<number, number>()
    yearExpenses.forEach(e => { const m = getMonth(expDate(e)); byMonth.set(m, (byMonth.get(m) ?? 0) + e.total) })
    const topMonthNum = [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const topMonth = topMonthNum !== undefined ? format(new Date(now.getFullYear(), topMonthNum), "MMMM", { locale: es }) : "—"

    const monthsElapsed = Math.max(getMonth(now) + 1, 1)
    return {
      totalYear, topCatLabel, topMerchantName, topMerchantCount,
      topMonth, count: yearExpenses.length,
      monthlyAvg: totalYear / monthsElapsed,
    }
  }, [yearExpenses, categories])

  if (isLoading) return (
    <div className="space-y-2">
      <Skeleton className="h-24 rounded-2xl" />
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    </div>
  )

  if (!stats) return (
    <p className="text-xs text-muted-foreground text-center py-4">
      Aún no hay datos para mostrar estadísticas del año.
    </p>
  )

  return (
    <div className="space-y-3">
      {/* Hero total */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 p-4 text-center">
        <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-widest mb-1">
          {now.getFullYear()} · Total gastado
        </p>
        <p className="text-4xl font-black tabular-nums tracking-tight">{formatCurrency(stats.totalYear)}</p>
        <p className="text-xs text-muted-foreground mt-1.5 flex items-center justify-center gap-2">
          <span>~{formatCurrency(stats.monthlyAvg)}/mes</span>
          <span className="text-border">·</span>
          <span>{stats.count} gastos</span>
        </p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-2">
        {/* Categoría top */}
        <StatTile
          icon={<Tag className="h-4 w-4" />}
          iconClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
          label="Categoría top"
          value={stats.topCatLabel}
        />
        {/* Mes más activo */}
        <StatTile
          icon={<Calendar className="h-4 w-4" />}
          iconClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          label="Mes más activo"
          value={stats.topMonth}
          valueClass="capitalize"
        />
        {/* Comercio favorito */}
        <StatTile
          icon={<Store className="h-4 w-4" />}
          iconClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          label="Comercio favorito"
          value={stats.topMerchantName}
          sub={`${stats.topMerchantCount} visitas este año`}
          className="col-span-2"
        />
        {/* Gasto mensual */}
        <StatTile
          icon={<TrendingDown className="h-4 w-4" />}
          iconClass="bg-rose-500/10 text-rose-600 dark:text-rose-400"
          label="Media mensual"
          value={formatCurrency(stats.monthlyAvg)}
          valueClass="tabular-nums"
          className="col-span-2"
        />
      </div>
    </div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  icon, iconClass, label, value, sub, valueClass, className,
}: {
  icon: React.ReactNode
  iconClass: string
  label: string
  value: string
  sub?: string
  valueClass?: string
  className?: string
}) {
  return (
    <div className={`rounded-xl border bg-card p-3 space-y-2 ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        <span className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${iconClass}`}>
          {icon}
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className={`text-sm font-bold truncate ${valueClass ?? ""}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )
}
