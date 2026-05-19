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

    const byDow = new Map<number, number>()
    yearExpenses.forEach(e => { const d = getDay(expDate(e)); byDow.set(d, (byDow.get(d) ?? 0) + 1) })
    const topDowNum = [...byDow.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

    const monthsElapsed = Math.max(getMonth(now) + 1, 1)
    return {
      totalYear, topCatLabel, topMerchantName, topMerchantCount,
      topMonth, count: yearExpenses.length,
      monthlyAvg: totalYear / monthsElapsed,
    }
  }, [yearExpenses, categories])

  if (isLoading) return (
    <div className="grid grid-cols-2 gap-2">
      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
    </div>
  )

  if (!stats) return (
    <p className="text-xs text-muted-foreground text-center py-4">
      Aún no hay datos para mostrar estadísticas del año.
    </p>
  )

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 p-4 text-center">
        <p className="text-[10px] font-semibold text-primary/70 uppercase tracking-widest mb-1">
          {now.getFullYear()} · Total gastado
        </p>
        <p className="text-3xl font-bold tabular-nums">{formatCurrency(stats.totalYear)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          ~{formatCurrency(stats.monthlyAvg)} / mes · {stats.count} gastos
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-muted/40 border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Categoría top</p>
          <p className="text-sm font-bold mt-1 truncate">{stats.topCatLabel}</p>
        </div>
        <div className="rounded-xl bg-muted/40 border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mes más activo</p>
          <p className="text-sm font-bold mt-1 capitalize">{stats.topMonth}</p>
        </div>
        <div className="rounded-xl bg-muted/40 border p-3 col-span-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Comercio favorito</p>
          <p className="text-sm font-bold mt-1 truncate">{stats.topMerchantName}</p>
          <p className="text-[10px] text-muted-foreground">{stats.topMerchantCount} visitas este año</p>
        </div>
      </div>
    </div>
  )
}
