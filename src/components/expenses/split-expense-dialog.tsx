"use client"

import { useState, useMemo } from "react"
import { useAddExpense, useDeleteExpense } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { DEFAULT_CATEGORIES } from "@/lib/constants"
import { formatCurrency, cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { Plus, Scissors, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Expense } from "@/types"

interface SplitLine {
  id: string
  category: string
  amount: string
  notes: string
}

function generateId() {
  return `split-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

interface SplitExpenseDialogProps {
  expense: Expense
  open: boolean
  onClose: () => void
}

export function SplitExpenseDialog({ expense, open, onClose }: SplitExpenseDialogProps) {
  const { data: categories = [] } = useCategories()
  const allCats = categories.length > 0 ? categories : DEFAULT_CATEGORIES
  const addExpense = useAddExpense()
  const deleteExpense = useDeleteExpense()

  const halfAmount = (expense.total / 2).toFixed(2)

  const [lines, setLines] = useState<SplitLine[]>(() => [
    { id: generateId(), category: expense.category, amount: halfAmount, notes: "" },
    { id: generateId(), category: expense.category, amount: halfAmount, notes: "" },
  ])

  const [isSubmitting, setIsSubmitting] = useState(false)

  const distributedTotal = useMemo(
    () => lines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0),
    [lines]
  )

  const isBalanced = Math.abs(distributedTotal - expense.total) <= 0.01
  const progressValue = Math.min((distributedTotal / expense.total) * 100, 100)
  const isOver = distributedTotal > expense.total + 0.01

  function addLine() {
    if (lines.length >= 8) return
    setLines((prev) => [
      ...prev,
      { id: generateId(), category: expense.category, amount: "0.00", notes: "" },
    ])
  }

  function removeLine(id: string) {
    if (lines.length <= 2) return
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  function updateLine(id: string, field: keyof SplitLine, value: string) {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    )
  }

  async function handleConfirm() {
    if (!isBalanced || isSubmitting) return

    setIsSubmitting(true)
    try {
      const expenseDate = expense.date.toDate()

      // Create new split expenses
      await Promise.all(
        lines.map((line, i) =>
          addExpense.mutateAsync({
            merchant: expense.merchant,
            date: expenseDate,
            category: line.category,
            total: parseFloat(line.amount),
            subtotal: parseFloat(line.amount),
            tax: 0,
            currency: expense.currency,
            paymentMethod: expense.paymentMethod,
            reference: null,
            tags: expense.tags ?? [],
            notes: line.notes || expense.notes,
            items: [],
            receiptImageUrl: null,
            account: expense.account,
            ...(expense.privacy ? { privacy: expense.privacy } : {}),
          } as Parameters<typeof addExpense.mutateAsync>[0])
        )
      )

      // Delete original expense
      await deleteExpense.mutateAsync(expense.id)

      toast.success(`Gasto dividido en ${lines.length} partes`)
      onClose()
    } catch {
      toast.error("Error al dividir el gasto")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-4 w-4" />
            Dividir gasto — {expense.merchant}
          </DialogTitle>
        </DialogHeader>

        {/* Original expense info */}
        <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-0.5 text-sm">
          <p className="font-semibold">{expense.merchant}</p>
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>{format(expense.date.toDate(), "dd MMM yyyy", { locale: es })}</span>
            <span className="font-bold text-foreground tabular-nums">
              {formatCurrency(expense.total, expense.currency)}
            </span>
          </div>
        </div>

        {/* Split lines */}
        <div className="space-y-2">
          {lines.map((line, idx) => (
            <div key={line.id} className="flex items-start gap-2 rounded-lg border p-2">
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <div className="flex gap-1.5">
                  <Select
                    value={line.category}
                    onValueChange={(v) => updateLine(line.id, "category", v)}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
                      <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {allCats.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="text-xs">
                          {cat.icon} {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={line.amount}
                    onChange={(e) => updateLine(line.id, "amount", e.target.value)}
                    className="h-8 text-xs w-24 tabular-nums shrink-0"
                    placeholder="0.00"
                  />
                </div>

                <Input
                  placeholder={`Notas parte ${idx + 1} (opcional)`}
                  value={line.notes}
                  onChange={(e) => updateLine(line.id, "notes", e.target.value)}
                  className="h-7 text-xs"
                />
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeLine(line.id)}
                disabled={lines.length <= 2}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add line button */}
        {lines.length < 8 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-xs h-8"
            onClick={addLine}
          >
            <Plus className="h-3.5 w-3.5" />
            Añadir línea
          </Button>
        )}

        {/* Distribution summary */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Distribuido:{" "}
              <span className={cn("font-semibold tabular-nums", isOver ? "text-destructive" : isBalanced ? "text-primary" : "text-foreground")}>
                {formatCurrency(distributedTotal, expense.currency)}
              </span>
            </span>
            <span>
              Total:{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {formatCurrency(expense.total, expense.currency)}
              </span>
            </span>
          </div>

          <Progress
            value={progressValue}
            className={cn(
              "h-1.5",
              isOver ? "[&>div]:bg-destructive" : isBalanced ? "[&>div]:bg-primary" : ""
            )}
          />

          {isOver && (
            <p className="text-xs text-destructive">
              Excede el total por {formatCurrency(distributedTotal - expense.total, expense.currency)}
            </p>
          )}
          {!isBalanced && !isOver && (
            <p className="text-xs text-muted-foreground">
              Faltan {formatCurrency(expense.total - distributedTotal, expense.currency)} por distribuir
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isBalanced || isSubmitting}
            className="flex-1 gap-1.5"
          >
            <Scissors className="h-3.5 w-3.5" />
            {isSubmitting ? "Dividiendo…" : "Confirmar división"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
