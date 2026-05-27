"use client"

import { TriangleAlert } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useAnomalies } from "@/hooks/use-anomalies"
import { useCategories } from "@/hooks/use-categories"
import { formatCurrency } from "@/lib/utils"

export function AnomalyAlertsCard() {
  const { data: anomalies = [], isLoading } = useAnomalies()
  const { data: categories = [] } = useCategories()

  if (isLoading || anomalies.length === 0) return null

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-amber-200 dark:border-amber-800">
        <div className="h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
          <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
          Gastos inusuales esta semana
        </p>
        <span className="ml-auto text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 px-2 py-0.5">
          {anomalies.length}
        </span>
      </div>

      {/* List */}
      <div className="divide-y divide-amber-200/60 dark:divide-amber-800/60">
        {anomalies.map((anomaly) => {
          const catMeta = categories.find((c) => c.id === anomaly.category)
          const emoji = catMeta?.icon ?? "📦"
          const catName = catMeta?.name ?? anomaly.category
          const dateLabel = format(new Date(anomaly.date), "d MMM", { locale: es })

          return (
            <div
              key={anomaly.id}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-sm bg-amber-100 dark:bg-amber-900/40">
                {emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate leading-tight text-foreground">
                  {anomaly.description}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {catName} · {dateLabel}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                  {formatCurrency(anomaly.amount, anomaly.currency)}
                </p>
                <p className="text-xs text-amber-500 dark:text-amber-500">
                  {anomaly.ratio.toFixed(1)}x tu media
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
