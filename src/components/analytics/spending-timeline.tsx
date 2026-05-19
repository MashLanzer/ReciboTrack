"use client"

import { useMemo } from "react"
import type { Expense } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { subDays, format, startOfDay, endOfDay, eachDayOfInterval } from "date-fns"
import { es } from "date-fns/locale"
import { formatCurrency } from "@/lib/utils"
import { AXIS_TICK, GRID_STROKE, TOOLTIP_STYLE_SM } from "@/lib/chart-theme"
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  ReferenceLine,
} from "recharts"
import { Activity } from "lucide-react"

interface SpendingTimelineProps {
  expenses: Expense[]
  /** Number of days to show. Default: 30 */
  days?: number
}

export function SpendingTimeline({ expenses, days = 30 }: SpendingTimelineProps) {
  const chartData = useMemo(() => {
    const now = new Date()
    const start = startOfDay(subDays(now, days - 1))
    const end = endOfDay(now)
    const dayList = eachDayOfInterval({ start, end })

    // Build daily totals
    const byDay: Record<string, number> = {}
    expenses.forEach((e) => {
      const d = e.date.toDate()
      if (d < start || d > end) return
      const key = format(d, "yyyy-MM-dd")
      byDay[key] = (byDay[key] ?? 0) + e.total
    })

    // Cumulative + per-day
    let cumulative = 0
    return dayList.map((day) => {
      const key = format(day, "yyyy-MM-dd")
      const daily = byDay[key] ?? 0
      cumulative += daily
      return {
        date: format(day, "dd MMM", { locale: es }),
        daily,
        cumulative: parseFloat(cumulative.toFixed(2)),
      }
    })
  }, [expenses, days])

  const avg = useMemo(() => {
    const total = chartData.reduce((a, d) => a + d.daily, 0)
    const nonZero = chartData.filter((d) => d.daily > 0).length
    return nonZero > 0 ? total / nonZero : 0
  }, [chartData])

  const maxDay = useMemo(() => {
    return chartData.reduce((a, d) => (d.daily > a.daily ? d : a), { date: "", daily: 0, cumulative: 0 })
  }, [chartData])

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-primary" />
            Timeline de gastos — {days} días
          </CardTitle>
          {/* Interaction hint — auto-fades after 3.5 s, only shown once */}
          <span className="hint-fade-out shrink-0 inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground select-none">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
              <path d="M5 1v4M3 7c0 1.1.9 2 2 2s2-.9 2-2V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Toca para ver valores
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Promedio activo: <span className="font-semibold text-foreground">{formatCurrency(avg)}/día</span></span>
          {maxDay.daily > 0 && (
            <span>Pico: <span className="font-semibold text-foreground">{maxDay.date} · {formatCurrency(maxDay.daily)}</span></span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Daily bars */}
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Gasto diario</p>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="dailyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} strokeOpacity={0.4} vertical={false} />
              <XAxis
                dataKey="date"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                interval={Math.ceil(days / 8) - 1}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE_SM}
                formatter={(v) => [formatCurrency(Number(v ?? 0)), "Gasto"]}
              />
              {avg > 0 && (
                <ReferenceLine
                  y={avg}
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  label={{ value: "Avg", position: "insideTopRight", fontSize: 9, fill: "#f59e0b" }}
                />
              )}
              <Area
                type="monotone"
                dataKey="daily"
                fill="url(#dailyGrad)"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))", fill: "hsl(var(--primary))" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Cumulative line */}
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Gasto acumulado</p>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} strokeOpacity={0.4} vertical={false} />
              <XAxis
                dataKey="date"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                interval={Math.ceil(days / 8) - 1}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE_SM}
                formatter={(v) => [formatCurrency(Number(v ?? 0)), "Acumulado"]}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                fill="url(#cumGrad)"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))", fill: "#22c55e" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
