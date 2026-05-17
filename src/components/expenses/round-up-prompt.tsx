"use client"

import { useEffect, useState } from "react"
import { useUpdateGoalProgress } from "@/hooks/use-goals"
import { formatCurrency, cn } from "@/lib/utils"
import type { Expense } from "@/types"
import { toast } from "sonner"

interface Props {
  expense: Expense
  goalId: string
  goalName: string
  goalCurrentAmount: number
  onDismiss: () => void
}

export function RoundUpPrompt({ expense, goalId, goalName, goalCurrentAmount, onDismiss }: Props) {
  const roundedUp = Math.ceil(expense.total)
  const diff = parseFloat((roundedUp - expense.total).toFixed(2))
  const updateProgress = useUpdateGoalProgress()
  const [visible, setVisible] = useState(true)

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300)
    }, 8000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  // If already whole number — don't show
  if (diff === 0) return null

  async function handleConfirm() {
    try {
      await updateProgress.mutateAsync({
        id: goalId,
        currentAmount: goalCurrentAmount + diff,
      })
      toast.success(`+${formatCurrency(diff)} añadido a "${goalName}"`)
    } catch {
      toast.error("Error al añadir redondeo")
    }
    setVisible(false)
    setTimeout(onDismiss, 300)
  }

  function handleDismiss() {
    setVisible(false)
    setTimeout(onDismiss, 300)
  }

  return (
    <div className={cn(
      "fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-50",
      "rounded-2xl border bg-card shadow-xl shadow-black/10 p-4 space-y-3",
      "transition-all duration-300",
      visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}>
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0">🪙</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Redondear gasto</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatCurrency(expense.total, expense.currency)} → {formatCurrency(roundedUp, expense.currency)} · Añadir{" "}
            <strong className="text-foreground">{formatCurrency(diff, expense.currency)}</strong> a &ldquo;{goalName}&rdquo;?
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={updateProgress.isPending}
          className="flex-1 h-8 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          Añadir
        </button>
        <button
          onClick={handleDismiss}
          className="flex-1 h-8 rounded-xl border bg-muted text-xs font-semibold hover:bg-muted/80 transition-colors"
        >
          No
        </button>
      </div>
    </div>
  )
}
