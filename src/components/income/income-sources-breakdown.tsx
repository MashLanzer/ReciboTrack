"use client"

import { useMemo } from "react"
import { startOfYear, endOfYear, subMonths, startOfMonth, endOfMonth, getMonth, getYear } from "date-fns"
import { useIncomePeriod, type Income } from "@/hooks/use-income"
import { formatCurrency } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface SourceMeta {
  label: string
  emoji: string
  color: string
}

const SOURCE_META: Record<string, SourceMeta> = {
  "Nómina":      { label: "Nómina",      emoji: "💼", color: "hsl(220 90% 56%)" },
  "Freelance":   { label: "Freelance",   emoji: "💻", color: "hsl(280 70% 56%)" },
  "Inversiones": { label: "Inversiones", emoji: "📈", color: "hsl(142 71% 45%)" },
  "Alquiler":    { label: "Alquiler",    emoji: "🏠", color: "hsl(38 92% 50%)" },
  "Otro":        { label: "Otros",       emoji: "📦", color: "hsl(0 0% 55%)" },
}

function normSource(s: string): string {
  for (const key of Object.keys(SOURCE_META)) {
    if (s.toLowerCase().includes(key.toLowerCase())) return key
  }
  return "Otro"
}

export function IncomeSourcesBreakdown() {
  const now = new Date()
  const yearStart = startOfYear(now)
  const yearEnd   = endOfYear(now)

  const { data: incomeAll = [], isLoading } = useIncomePeriod(yearStart, yearEnd)

  // Build per-source totals and per-source per-month (last 7 months) sparkline
  const { sources, totalYear } = useMemo(() => {
    const map = new Map<string, number>()
    incomeAll.forEach((inc: Income) => {
      const key = normSource(inc.source)
      map.set(key, (map.get(key) ?? 0) + inc.amount)
    })
    const total = [...map.values()].reduce((s, v) => s + v, 0)
    const sorted = [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, amount]) => ({
        key,
        meta: SOURCE_META[key] ?? SOURCE_META["Otro"],
        amount,
        pct: total > 0 ? Math.round((amount / total) * 100) : 0,
      }))
    return { sources: sorted, totalYear: total }
  }, [incomeAll])

  // Sparkline: 7 months ending this month
  const sparkMonths = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = subMonths(now, 6 - i)
      return { year: getYear(d), month: getMonth(d) + 1, start: startOfMonth(d), end: endOfMonth(d) }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  , [])

  const sparkData = useMemo(() => {
    // Map sourceKey → array of 7 monthly totals
    const result = new Map<string, number[]>()
    for (const { key } of sources) {
      const monthly = sparkMonths.map(({ year, month }) => {
        return incomeAll
          .filter((inc: Income) => {
            const d = inc.date.toDate()
            return normSource(inc.source) === key && d.getFullYear() === year && d.getMonth() + 1 === month
          })
          .reduce((s: number, inc: Income) => s + inc.amount, 0)
      })
      result.set(key, monthly)
    }
    return result
  }, [incomeAll, sources, sparkMonths])

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <Skeleton className="h-4 w-40" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    )
  }

  if (sources.length === 0) return null

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fuentes de ingreso</p>
          <p className="text-sm font-bold mt-0.5">Desglose anual</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total {now.getFullYear()}</p>
          <p className="text-base font-bold tabular-nums text-green-600">{formatCurrency(totalYear)}</p>
        </div>
      </div>

      {/* Source cards */}
      <div className="space-y-3">
        {sources.map(({ key, meta, amount, pct }) => {
          const monthly = sparkData.get(key) ?? []
          const maxMonthly = Math.max(...monthly, 1)
          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center text-base shrink-0">
                  {meta.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{meta.label}</p>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums">{formatCurrency(amount)}</p>
                      <p className="text-xs text-muted-foreground">{pct}% del total</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: meta.color }}
                    />
                  </div>
                </div>
              </div>

              {/* Sparkline: 7 colored dots */}
              <div className="flex items-end gap-1 pl-11">
                {monthly.map((val, i) => {
                  const h = maxMonthly > 0 ? Math.round((val / maxMonthly) * 20) + 4 : 4
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-sm transition-all"
                      style={{
                        height: `${h}px`,
                        background: val > 0 ? meta.color : "hsl(var(--muted))",
                        opacity: i === 6 ? 1 : 0.45 + i * 0.08,
                      }}
                      title={`${sparkMonths[i]?.month}/${sparkMonths[i]?.year}: ${formatCurrency(val)}`}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
