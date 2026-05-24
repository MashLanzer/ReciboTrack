"use client"

import { useState } from "react"
import {
  format,
  startOfMonth,
  endOfMonth,
  getDate,
  getDay,
  getDaysInMonth,
  differenceInDays,
  isToday,
  addMonths,
} from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import type { RecurringTemplate } from "@/types"

interface Props {
  templates: RecurringTemplate[]
}

/** Build an array of Date | null for a 7-column grid (Mon–Sun).
 *  Leading nulls pad the first week, trailing nulls are not added. */
function buildCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = startOfMonth(new Date(year, month))
  const days: (Date | null)[] = []
  // Monday = 0, Sunday = 6
  const startPad = (getDay(firstDay) + 6) % 7
  for (let i = 0; i < startPad; i++) days.push(null)
  for (let d = 1; d <= getDaysInMonth(firstDay); d++) {
    days.push(new Date(year, month, d))
  }
  return days
}

/** Returns true when a template is due on the given date. */
function isDueOn(template: RecurringTemplate, date: Date): boolean {
  const nextDue = template.nextDueDate.toDate()

  switch (template.frequency) {
    case "monthly":
      // Same day of month every month (template must exist before this date)
      return getDate(nextDue) === getDate(date)

    case "weekly": {
      const diff = differenceInDays(date, nextDue)
      if (diff < 0) return false
      return diff % 7 === 0
    }

    case "biweekly": {
      const diff = differenceInDays(date, nextDue)
      if (diff < 0) return false
      return diff % 14 === 0
    }

    case "yearly":
      return (
        nextDue.getMonth() === date.getMonth() &&
        nextDue.getDate() === date.getDate()
      )

    default:
      return false
  }
}

function getPaymentsForDay(date: Date, templates: RecurringTemplate[]): RecurringTemplate[] {
  return templates.filter((t) => isDueOn(t, date))
}

export function RecurringCalendar({ templates }: Props) {
  const today = new Date()
  const [displayMonth, setDisplayMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  )

  const year = displayMonth.getFullYear()
  const month = displayMonth.getMonth()

  const calendarDays = buildCalendarDays(year, month)

  // Compute monthly total: sum of all template amounts that fall in this month
  const monthStart = startOfMonth(displayMonth)
  const monthEnd = endOfMonth(displayMonth)
  let monthTotal = 0
  for (const t of templates) {
    // Count how many days in this month the template is due
    const nextDue = t.nextDueDate.toDate()
    let count = 0
    let cursor = new Date(monthStart)
    while (cursor <= monthEnd) {
      if (isDueOn(t, cursor)) count++
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
    }
    monthTotal += count * t.total
    // Suppress unused variable warning for nextDue
    void nextDue
  }

  function prevMonth() {
    setDisplayMonth((d) => addMonths(d, -1))
  }

  function nextMonth() {
    setDisplayMonth((d) => addMonths(d, 1))
  }

  const DAY_HEADERS = ["L", "M", "X", "J", "V", "S", "D"]

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-semibold capitalize text-sm">
          {format(displayMonth, "MMMM yyyy", { locale: es })}
        </p>
        <button
          onClick={nextMonth}
          className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 text-center">
        {DAY_HEADERS.map((d) => (
          <p key={d} className="text-[10px] font-mono text-muted-foreground py-1">
            {d}
          </p>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((day, i) => {
          const payments = day ? getPaymentsForDay(day, templates) : []
          return (
            <div
              key={i}
              className={cn(
                "min-h-[44px] rounded-lg p-1",
                day ? "hover:bg-muted/50 cursor-default" : ""
              )}
            >
              {day && (
                <>
                  <p
                    className={cn(
                      "text-xs text-center mb-0.5 leading-4",
                      isToday(day) && "font-bold text-primary"
                    )}
                  >
                    {getDate(day)}
                  </p>
                  {payments.map((t) => (
                    <div
                      key={t.id}
                      className="text-[8px] truncate bg-warning/15 text-warning rounded px-0.5 mb-0.5 leading-4"
                      title={`${t.merchant} — ${formatCurrency(t.total, t.currency)}`}
                    >
                      {t.merchant.slice(0, 6)}
                    </div>
                  ))}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Monthly total */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground capitalize">
          Total en {format(displayMonth, "MMMM", { locale: es })}
        </p>
        <p className="font-bold tabular-nums text-sm">{formatCurrency(monthTotal)}</p>
      </div>
    </div>
  )
}
