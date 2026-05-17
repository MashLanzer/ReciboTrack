"use client"

import { useMemo, useState } from "react"
import type { Expense } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns"
import { es } from "date-fns/locale"
import { formatCurrency } from "@/lib/utils"
import { AXIS_TICK, GRID_STROKE, TOOLTIP_STYLE_SM } from "@/lib/chart-theme"
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts"
import { TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface AdvancedChartProps {
  expenses: Expense[]
}

type Overlay = "bars" | "ma" | "trend"

export function AdvancedChart({ expenses }: AdvancedChartProps) {
  const [overlays, setOverlays] = useState<Set<Overlay>>(new Set(["bars"]))

  function toggle(o: Overlay) {
    setOverlays((prev) => {
      const next = new Set(prev)
      next.has(o) ? next.delete(o) : next.add(o)
      return next
    })
  }

  const chartData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const offset = 5 - i
      const monthDate = subMonths(now, offset)
      const start = startOfMonth(monthDate)
      const end = endOfMonth(monthDate)
      const total = expenses
        .filter((e) => {
          const d = e.date.toDate()
          return d >= start && d <= end
        })
        .reduce((a, e) => a + e.total, 0)
      return {
        month: format(monthDate, "MMM", { locale: es }),
        total,
        i,
      }
    })
  }, [expenses])

  // 3-month rolling average
  const withMA = useMemo(() => {
    return chartData.map((d, i) => {
      if (i < 2) return { ...d, ma: null as number | null }
      const slice = chartData.slice(i - 2, i + 1)
      const avg = slice.reduce((a, x) => a + x.total, 0) / 3
      return { ...d, ma: parseFloat(avg.toFixed(2)) }
    })
  }, [chartData])

  // Linear regression trend
  const withTrend = useMemo(() => {
    const n = chartData.length
    const sumX = chartData.reduce((a, _, i) => a + i, 0)
    const sumY = chartData.reduce((a, d) => a + d.total, 0)
    const sumXY = chartData.reduce((a, d, i) => a + i * d.total, 0)
    const sumX2 = chartData.reduce((a, _, i) => a + i * i, 0)
    const denom = n * sumX2 - sumX * sumX
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0
    const intercept = (sumY - slope * sumX) / n
    return withMA.map((d, i) => ({
      ...d,
      trend: parseFloat((slope * i + intercept).toFixed(2)),
    }))
  }, [withMA, chartData])

  // Min/max bands per point (just the value itself for area bounds — uses global min/max)
  const withBands = useMemo(() => {
    const values = chartData.map((d) => d.total)
    const globalMin = Math.min(...values)
    const globalMax = Math.max(...values)
    return withTrend.map((d) => ({
      ...d,
      bandMin: globalMin,
      bandMax: globalMax,
    }))
  }, [withTrend, chartData])

  const BUTTONS: { id: Overlay; label: string }[] = [
    { id: "bars", label: "Barras" },
    { id: "ma", label: "Media móvil" },
    { id: "trend", label: "Tendencia" },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            Gráfica avanzada — 6 meses
          </CardTitle>
          <div className="flex items-center gap-1 flex-wrap">
            {BUTTONS.map((b) => (
              <button
                key={b.id}
                onClick={() => toggle(b.id)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                  overlays.has(b.id)
                    ? "bg-foreground text-background border-foreground"
                    : "bg-muted/50 text-muted-foreground border-border hover:border-foreground/30"
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Combina múltiples indicadores para analizar tendencias</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={withBands} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} strokeOpacity={0.5} vertical={false} />
            <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={32}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE_SM}
              formatter={(v, name) => {
                const labels: Record<string, string> = {
                  total: "Gasto",
                  ma: "Media móvil",
                  trend: "Tendencia",
                  bandMin: "Mínimo",
                  bandMax: "Máximo",
                }
                return [formatCurrency(Number(v ?? 0)), labels[String(name)] ?? String(name)]
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 10, paddingTop: 6 }}
              formatter={(value) => {
                const labels: Record<string, string> = {
                  total: "Gasto mensual",
                  ma: "Media móvil (3m)",
                  trend: "Tendencia lineal",
                  bandMin: "Banda mín",
                  bandMax: "Banda máx",
                }
                return labels[value] ?? value
              }}
            />

            {/* Variance band */}
            {overlays.has("bars") && (
              <Area
                dataKey="bandMax"
                fill="hsl(var(--primary))"
                fillOpacity={0.06}
                stroke="none"
                legendType="none"
              />
            )}
            {overlays.has("bars") && (
              <Area
                dataKey="bandMin"
                fill="hsl(var(--background))"
                fillOpacity={1}
                stroke="none"
                legendType="none"
              />
            )}

            {/* Bars */}
            {overlays.has("bars") && (
              <Bar
                dataKey="total"
                fill="hsl(var(--foreground))"
                fillOpacity={0.75}
                radius={[4, 4, 0, 0]}
                name="total"
              />
            )}

            {/* Moving average */}
            {overlays.has("ma") && (
              <Line
                type="monotone"
                dataKey="ma"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                connectNulls
                name="ma"
              />
            )}

            {/* Trend line */}
            {overlays.has("trend") && (
              <Line
                type="linear"
                dataKey="trend"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                connectNulls
                name="trend"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
