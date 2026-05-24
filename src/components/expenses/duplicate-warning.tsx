"use client"

import { AlertTriangle } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { formatCurrency } from "@/lib/utils"
import type { Expense } from "@/types"

interface DuplicateWarningProps {
  duplicates: Expense[]
  onDismiss: () => void
}

export function DuplicateWarning({ duplicates, onDismiss }: DuplicateWarningProps) {
  if (duplicates.length === 0) return null

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
        <p className="text-sm font-semibold text-warning">Posible duplicado detectado</p>
      </div>

      <ul className="space-y-1 pl-6">
        {duplicates.map((expense) => (
          <li key={expense.id} className="text-xs text-muted-foreground">
            <span className="font-medium">{expense.merchant}</span>
            {" · "}
            {formatCurrency(expense.total, expense.currency)}
            {" · "}
            {format(expense.date.toDate(), "dd MMM yyyy", { locale: es })}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onDismiss}
        className="text-xs font-medium text-warning underline-offset-2 hover:underline transition-colors"
      >
        Ignorar y continuar
      </button>
    </div>
  )
}
