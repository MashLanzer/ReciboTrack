"use client"

import { useMonthlyComparison } from "@/hooks/use-monthly-comparison"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"

const PALETTE = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"]

const CHART_HEIGHT = 220
const CHART_PADDING = { top: 16, right: 12, bottom: 32, left: 48 }
const BAR_GROUP_GAP = 12 // px between month groups
const BAR_GAP = 2        // px between bars in a group

export function MonthlyComparisonChart() {
  const { data, isLoading, isError } = useMonthlyComparison()

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Comparativa mensual</CardTitle>
          <p className="text-xs text-muted-foreground">Últimos 6 meses por categoría</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 h-[140px]">
            {[70, 50, 85, 45, 65, 55].map((h, i) => (
              <div key={i} className="flex-1 flex gap-0.5 items-end">
                <div className="flex-1 bg-muted animate-pulse rounded-t" style={{ height: `${h}%` }} />
                <div className="flex-1 bg-muted animate-pulse rounded-t" style={{ height: `${h * 0.7}%` }} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isError || !data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Comparativa mensual</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No se pudo cargar la comparativa
          </p>
        </CardContent>
      </Card>
    )
  }

  const { months, categories, data: seriesData } = data

  if (months.length === 0 || categories.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Comparativa mensual</CardTitle>
          <p className="text-xs text-muted-foreground">Últimos 6 meses por categoría</p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            Sin datos para mostrar
          </p>
        </CardContent>
      </Card>
    )
  }

  // Compute max value for y-axis scaling
  const allValues = categories.flatMap((cat) => seriesData[cat] ?? [])
  const maxValue = Math.max(...allValues, 1)

  // Round max up to a nice number
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)))
  const niceMax = Math.ceil(maxValue / magnitude) * magnitude

  // Chart inner dimensions
  const innerW = 500 - CHART_PADDING.left - CHART_PADDING.right
  const innerH = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom

  const numMonths = months.length
  const numCats = categories.length

  // Width per month group
  const groupWidth = (innerW - BAR_GROUP_GAP * (numMonths - 1)) / numMonths
  const barWidth = Math.max(2, (groupWidth - BAR_GAP * (numCats - 1)) / numCats)

  // Y-axis: 4 tick lines
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    value: Math.round(niceMax * f),
    y: CHART_PADDING.top + innerH * (1 - f),
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Comparativa mensual</CardTitle>
        <p className="text-xs text-muted-foreground">Últimos 6 meses por categoría</p>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 500 ${CHART_HEIGHT}`}
            width="100%"
            style={{ display: "block", minWidth: 300 }}
            aria-label="Gráfico de comparativa mensual"
          >
            {/* Y-axis grid lines and labels */}
            {yTicks.map((tick) => (
              <g key={tick.value}>
                <line
                  x1={CHART_PADDING.left}
                  x2={500 - CHART_PADDING.right}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="currentColor"
                  strokeOpacity={0.07}
                  strokeWidth={1}
                />
                <text
                  x={CHART_PADDING.left - 4}
                  y={tick.y + 3.5}
                  textAnchor="end"
                  fontSize={8}
                  fill="currentColor"
                  fillOpacity={0.5}
                >
                  {tick.value >= 1000 ? `${(tick.value / 1000).toFixed(0)}k` : tick.value}
                </text>
              </g>
            ))}

            {/* Bars */}
            {months.map((month, mi) => {
              const groupX =
                CHART_PADDING.left + mi * (groupWidth + BAR_GROUP_GAP)

              return (
                <g key={month}>
                  {categories.map((cat, ci) => {
                    const value = seriesData[cat]?.[mi] ?? 0
                    const barH = (value / niceMax) * innerH
                    const x = groupX + ci * (barWidth + BAR_GAP)
                    const y = CHART_PADDING.top + innerH - barH
                    const color = PALETTE[ci % PALETTE.length]

                    return (
                      <rect
                        key={cat}
                        x={x}
                        y={y}
                        width={barWidth}
                        height={Math.max(barH, 0)}
                        fill={color}
                        rx={2}
                        ry={2}
                        fillOpacity={0.85}
                      >
                        <title>{`${month} · ${cat}: ${formatCurrency(value)}`}</title>
                      </rect>
                    )
                  })}

                  {/* X-axis label */}
                  <text
                    x={groupX + groupWidth / 2}
                    y={CHART_PADDING.top + innerH + 14}
                    textAnchor="middle"
                    fontSize={9}
                    fill="currentColor"
                    fillOpacity={0.6}
                    style={{ textTransform: "capitalize" }}
                  >
                    {month}
                  </text>
                </g>
              )
            })}

            {/* Y-axis line */}
            <line
              x1={CHART_PADDING.left}
              x2={CHART_PADDING.left}
              y1={CHART_PADDING.top}
              y2={CHART_PADDING.top + innerH}
              stroke="currentColor"
              strokeOpacity={0.15}
              strokeWidth={1}
            />

            {/* X-axis line */}
            <line
              x1={CHART_PADDING.left}
              x2={500 - CHART_PADDING.right}
              y1={CHART_PADDING.top + innerH}
              y2={CHART_PADDING.top + innerH}
              stroke="currentColor"
              strokeOpacity={0.15}
              strokeWidth={1}
            />
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 px-2">
          {categories.map((cat, i) => (
            <div key={cat} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              />
              <span className="text-xs text-muted-foreground truncate max-w-[100px]">{cat}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
