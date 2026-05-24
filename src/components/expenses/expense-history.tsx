"use client"

import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { Skeleton } from "@/components/ui/skeleton"
import { useExpenseHistory } from "@/hooks/use-expense-history"

const FIELD_LABELS: Record<string, string> = {
  merchant: "Comerciante",
  category: "Categoría",
  total: "Monto",
  notes: "Notas",
  account: "Cuenta",
  currency: "Moneda",
}

interface Props {
  expenseId: string
}

export function ExpenseHistory({ expenseId }: Props) {
  const { data, isLoading } = useExpenseHistory(expenseId)

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-3/4 rounded-lg" />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-3">
        Sin historial de cambios
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {data.map((entry) => (
        <li key={entry.id} className="rounded-lg bg-muted/40 px-3 py-2.5 text-xs">
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-foreground">
              {FIELD_LABELS[entry.field] ?? entry.field}
            </span>
            <span className="text-muted-foreground shrink-0">
              {formatDistanceToNow(new Date(entry.changedAt), { locale: es, addSuffix: true })}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground leading-snug">
            cambió de{" "}
            <span className="font-medium text-foreground line-through">{entry.oldValue || "—"}</span>
            {" "}a{" "}
            <span className="font-medium text-foreground">{entry.newValue || "—"}</span>
          </p>
        </li>
      ))}
    </ul>
  )
}
