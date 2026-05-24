"use client"

import { useMemo, useState } from "react"
import { differenceInDays } from "date-fns"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useRecurring } from "@/hooks/use-recurring"
import { formatCurrency } from "@/lib/utils"
import { toDate } from "@/lib/utils"
import type { RecurringTemplate } from "@/types"

function yearsActive(item: RecurringTemplate): number {
  if (!item.createdAt) return 0
  return Math.floor(differenceInDays(new Date(), toDate(item.createdAt)) / 365)
}

function estimatedTotal(item: RecurringTemplate, years: number): number {
  const perYear =
    item.frequency === "weekly"   ? item.total * 52 :
    item.frequency === "biweekly" ? item.total * 26 :
    item.frequency === "monthly"  ? item.total * 12 :
    item.total
  return perYear * years
}

export function AnniversaryWidget() {
  const { data: recurring = [] } = useRecurring()
  const [collapsed, setCollapsed] = useState(false)

  const eligible = useMemo(() =>
    recurring
      .map((item) => ({ item, years: yearsActive(item) }))
      .filter(({ years }) => years >= 1)
      .sort((a, b) => b.years - a.years)
      .slice(0, 3),
    [recurring]
  )

  if (eligible.length === 0) return null

  return (
    <div className="rounded-2xl border bg-warning/5 border-warning/20 p-4 space-y-3">
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between"
      >
        <div className="text-left">
          <p className="text-[10px] font-mono uppercase tracking-widest text-warning/70">Aniversarios</p>
          <p className="text-sm font-bold mt-0.5">🎂 Suscripciones veteranas</p>
        </div>
        {collapsed
          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
          : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="space-y-2">
          {eligible.map(({ item, years }) => {
            const total = estimatedTotal(item, years)
            return (
              <div key={item.id} className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-warning/10 flex items-center justify-center text-base shrink-0">
                  🎂
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{item.merchant}</p>
                  <p className="text-xs text-muted-foreground">
                    Total estimado: {formatCurrency(total, item.currency)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">
                  {years} año{years > 1 ? "s" : ""}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
