"use client"

import { formatCurrency } from "@/lib/utils"
import { TYPE_LABEL, type Entity, type EntityType } from "@/hooks/use-entities"
import { useExpensesPeriod } from "@/hooks/use-expenses"
import { subMonths } from "date-fns"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useMemo } from "react"
import type { Expense } from "@/types"

interface Props {
  entity: Entity
  onClose: () => void
}

export function EntityPanel({ entity, onClose }: Props) {
  const now          = useMemo(() => new Date(), [])
  const sixMonthsAgo = useMemo(() => subMonths(now, 6), [now])
  const { data: expenses = [] } = useExpensesPeriod(sixMonthsAgo, now)

  // Find expenses connected to this entity via project/notes heuristic
  // (A full edge lookup would need a separate query — this is a fast client approximation)
  const relatedExpenses = useMemo(() => {
    const nameLower = entity.name.toLowerCase()
    return expenses.filter((e) =>
      (e.project ?? "").toLowerCase().includes(nameLower) ||
      (e.notes ?? "").toLowerCase().includes(nameLower) ||
      e.merchant.toLowerCase().includes(nameLower)
    ).slice(0, 10)
  }, [expenses, entity.name])

  const total = relatedExpenses.reduce((s, e) => s + e.total, 0)

  function toDate(val: unknown): Date {
    if (val && typeof val === "object" && "toDate" in val) return (val as { toDate: () => Date }).toDate()
    return new Date()
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ backgroundColor: `${entity.color}20` }}
        >
          {entity.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{entity.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{TYPE_LABEL[entity.type as EntityType]}</p>
        </div>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">×</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 p-4 border-b">
        <div className="rounded-xl bg-muted/40 p-3 text-center">
          <p className="text-xs text-muted-foreground">Total relacionado</p>
          <p className="text-base font-bold mt-0.5 tabular-nums">{formatCurrency(total)}</p>
        </div>
        <div className="rounded-xl bg-muted/40 p-3 text-center">
          <p className="text-xs text-muted-foreground">Gastos</p>
          <p className="text-base font-bold mt-0.5">{relatedExpenses.length}</p>
        </div>
      </div>

      {/* Related expenses */}
      <div className="flex-1 overflow-y-auto">
        {relatedExpenses.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Sin gastos relacionados detectados
          </p>
        ) : (
          <div className="divide-y">
            {relatedExpenses.map((exp) => (
              <div key={exp.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{exp.merchant}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(toDate(exp.date), "d MMM yyyy", { locale: es })} · {exp.category}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums shrink-0">
                  {formatCurrency(exp.total)} {exp.currency}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
