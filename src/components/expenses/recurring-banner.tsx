"use client"

import { useAddExpense } from "@/hooks/use-expenses"
import { useDueRecurring, useConfirmRecurring, useSnoozeRecurring } from "@/hooks/use-recurring"
import type { RecurringTemplate } from "@/types"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { RefreshCw, Clock, X } from "lucide-react"

export function RecurringBanner() {
  const { data: due = [], isLoading } = useDueRecurring()
  const confirmRecurring = useConfirmRecurring()
  const snoozeRecurring = useSnoozeRecurring()
  const addExpense = useAddExpense()

  if (isLoading || due.length === 0) return null

  async function handleAdd(t: RecurringTemplate) {
    try {
      await addExpense.mutateAsync({
        merchant: t.merchant,
        date: new Date(),
        items: [],
        subtotal: t.subtotal,
        tax: t.tax,
        total: t.total,
        paymentMethod: t.paymentMethod,
        reference: null,
        category: t.category,
        currency: t.currency,
        notes: t.notes,
        tags: t.tags,
        receiptImageUrl: null,
      })
      await confirmRecurring.mutateAsync({ id: t.id, frequency: t.frequency })
      toast.success(`"${t.merchant}" añadido`)
    } catch {
      toast.error("Error al añadir gasto recurrente")
    }
  }

  async function handleSnooze(id: string) {
    try {
      await snoozeRecurring.mutateAsync(id)
      toast.info("Recordatorio pospuesto 3 días")
    } catch {
      toast.error("Error al posponer")
    }
  }

  return (
    <div className="mb-4 space-y-2">
      {due.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3"
        >
          <RefreshCw className="h-4 w-4 shrink-0 text-warning" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{t.merchant}</p>
            <p className="text-xs text-muted-foreground">{t.currency} {t.total.toFixed(2)} · {t.frequency}</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => handleSnooze(t.id)}
              disabled={snoozeRecurring.isPending}
            >
              <Clock className="h-3 w-3" />
              Después
            </Button>
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => handleAdd(t)}
              disabled={addExpense.isPending || confirmRecurring.isPending}
            >
              Añadir
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
