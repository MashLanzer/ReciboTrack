"use client"

import { useForecast } from "@/hooks/use-forecast"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

export function ExpenseForecast() {
  const { data, isLoading, isError } = useForecast()

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            ))}
          </div>
          <div className="space-y-2 pt-2 border-t">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
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
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">No se pudo calcular la proyección</p>
        </CardContent>
      </Card>
    )
  }

  const { forecast, totalPredicted, currency } = data

  const topCategories = forecast[0]?.categories
    .slice()
    .sort((a, b) => b.predicted - a.predicted)
    .slice(0, 5) ?? []

  function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
    if (trend === "up") return <TrendingUp className="h-3.5 w-3.5 text-destructive" />
    if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-income" />
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
  }

  function trendColor(trend: "up" | "down" | "stable") {
    if (trend === "up") return "text-destructive"
    if (trend === "down") return "text-income"
    return "text-muted-foreground"
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Proyección de Gastos (próximos 3 meses)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {forecast.map((month, i) => (
            <div key={month.month} className="rounded-xl border bg-muted/20 px-3 py-2 space-y-0.5">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide truncate capitalize">
                {month.month.split(" ")[0]}
              </p>
              <p className="tabular-nums text-sm font-bold">
                {formatCurrency(totalPredicted[i] ?? 0, currency)}
              </p>
            </div>
          ))}
        </div>

        {topCategories.length > 0 && (
          <div className="border-t pt-3 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Top categorías — próximo mes
            </p>
            <table className="w-full">
              <tbody>
                {topCategories.map((cat) => (
                  <tr key={cat.category} className="border-b last:border-0">
                    <td className="py-1.5 pr-2">
                      <span className="text-xs font-medium truncate max-w-[120px] block">{cat.category}</span>
                    </td>
                    <td className="py-1.5 text-right pr-2">
                      <span className="text-xs tabular-nums font-semibold">
                        {formatCurrency(cat.predicted, currency)}
                      </span>
                    </td>
                    <td className="py-1.5 text-right w-6">
                      <span className={`inline-flex items-center justify-end ${trendColor(cat.trend)}`}>
                        <TrendIcon trend={cat.trend} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {topCategories.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Sin datos suficientes para proyectar
          </p>
        )}
      </CardContent>
    </Card>
  )
}
