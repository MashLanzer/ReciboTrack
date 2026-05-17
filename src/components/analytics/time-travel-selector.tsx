"use client"

import { useMemo } from "react"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { format, subMonths, addMonths } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface Props {
  year: number
  month: number // 0-indexed
  onMonthChange: (year: number, month: number) => void
}

export function TimeTravelSelector({ year, month, onMonthChange }: Props) {
  const now = useMemo(() => new Date(), [])
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth()

  const isCurrentMonth = year === nowYear && month === nowMonth

  const selectedDate = new Date(year, month, 1)
  const monthLabel = format(selectedDate, "MMMM yyyy", { locale: es })

  // Max 24 months back
  const minDate = subMonths(now, 23)
  const minYear = minDate.getFullYear()
  const minMonth = minDate.getMonth()

  const canGoBack = year > minYear || (year === minYear && month > minMonth)
  const canGoForward = !isCurrentMonth

  function goBack() {
    if (!canGoBack) return
    const prev = subMonths(selectedDate, 1)
    onMonthChange(prev.getFullYear(), prev.getMonth())
  }

  function goForward() {
    if (!canGoForward) return
    const next = addMonths(selectedDate, 1)
    onMonthChange(next.getFullYear(), next.getMonth())
  }

  function goToPresent() {
    onMonthChange(nowYear, nowMonth)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 rounded-2xl border bg-card p-3">
        <button
          onClick={goBack}
          disabled={!canGoBack}
          className={cn(
            "h-8 w-8 rounded-xl flex items-center justify-center transition-colors",
            canGoBack
              ? "text-foreground hover:bg-muted"
              : "text-muted-foreground/30 cursor-not-allowed"
          )}
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold capitalize">{monthLabel}</span>
        </div>

        <button
          onClick={goForward}
          disabled={!canGoForward}
          className={cn(
            "h-8 w-8 rounded-xl flex items-center justify-center transition-colors",
            canGoForward
              ? "text-foreground hover:bg-muted"
              : "text-muted-foreground/30 cursor-not-allowed"
          )}
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {!isCurrentMonth && (
        <div className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-base"></span>
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400 capitalize">
              Viendo {monthLabel}
            </span>
          </div>
          <button
            onClick={goToPresent}
            className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline underline-offset-2"
          >
            Volver al presente
          </button>
        </div>
      )}
    </div>
  )
}
