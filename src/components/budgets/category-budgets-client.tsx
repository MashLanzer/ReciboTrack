"use client"

import { useState, useRef, useMemo } from "react"
import { useCategoryBudgets, useSetCategoryBudget, useDeleteCategoryBudget } from "@/hooks/use-category-budgets"
import { useCategories } from "@/hooks/use-categories"
import { useExpensesForMonth } from "@/hooks/use-expenses"
import { useStarred, useToggleStarCategory } from "@/hooks/use-starred"
import { formatCurrency, cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { StarButton } from "@/components/ui/star-button"
import { Pencil, Check, X, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { SnoozeControls } from "@/components/notifications/snooze-controls"

function getProgressColor(pct: number): string {
  if (pct >= 90) return "[&>div]:bg-rose-500"
  if (pct >= 70) return "[&>div]:bg-amber-500"
  return "[&>div]:bg-emerald-500"
}

function getPctColor(pct: number): string {
  if (pct >= 90) return "text-rose-600"
  if (pct >= 70) return "text-amber-600"
  return "text-emerald-600"
}

export function CategoryBudgetsClient() {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const { data: categories = [], isLoading: loadingCats } = useCategories()
  const { data: budgets = [], isLoading: loadingBudgets } = useCategoryBudgets(month)
  const { data: expenses = [], isLoading: loadingExp } = useExpensesForMonth(now.getFullYear(), now.getMonth() + 1)

  const setBudget = useSetCategoryBudget()
  const deleteBudget = useDeleteCategoryBudget()
  const { data: starred } = useStarred()
  const toggleStar = useToggleStarCategory()

  // Map categoryId → budget
  const budgetMap = useMemo(() => {
    const map = new Map<string, (typeof budgets)[0]>()
    for (const b of budgets) map.set(b.categoryId, b)
    return map
  }, [budgets])

  // Map categoryId → total spent this month
  const spendMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of expenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.total)
    }
    return map
  }, [expenses])

  // Editing state per category
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // Starred categories float to top (must be before any early returns)
  const starredCats = starred?.categories ?? []
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const aStarred = starredCats.includes(a.id) ? 0 : 1
      const bStarred = starredCats.includes(b.id) ? 0 : 1
      return aStarred - bStarred
    })
  }, [categories, starredCats])

  function startEdit(categoryId: string) {
    const existing = budgetMap.get(categoryId)
    setEditValue(existing ? String(existing.amount) : "")
    setEditingId(categoryId)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValue("")
  }

  async function saveEdit(categoryId: string) {
    const amount = parseFloat(editValue)
    if (isNaN(amount) || amount <= 0) {
      toast.error("Ingresa un monto válido")
      return
    }
    try {
      await setBudget.mutateAsync({ categoryId, amount, currency: "USD", month })
      toast.success("Presupuesto guardado")
    } catch {
      toast.error("Error al guardar presupuesto")
    }
    setEditingId(null)
    setEditValue("")
  }

  async function handleDelete(categoryId: string) {
    const budget = budgetMap.get(categoryId)
    if (!budget) return
    try {
      await deleteBudget.mutateAsync({ id: budget.id, month })
      toast.success("Presupuesto eliminado")
    } catch {
      toast.error("Error al eliminar")
    }
  }

  if (loadingCats || loadingBudgets || loadingExp) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center text-muted-foreground text-sm">
        No hay categorías. Crea categorías primero.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-base">Presupuesto por categoría</h2>
        <span className="text-xs text-muted-foreground font-mono">{month}</span>
      </div>

      {sortedCategories.map((cat) => {
        const budget = budgetMap.get(cat.id)
        const spent = spendMap.get(cat.id) ?? 0
        const hasBudget = !!budget && budget.amount > 0
        const pct = hasBudget ? Math.min((spent / budget.amount) * 100, 100) : 0
        const isEditing = editingId === cat.id

        return (
          <div
            key={cat.id}
            className="rounded-2xl border bg-card px-4 py-3 space-y-2"
          >
            {/* Row 1: icon + name + controls */}
            <div className="flex items-center gap-3">
              <span className="text-xl shrink-0 leading-none">{cat.icon}</span>
              <StarButton
                isStarred={starredCats.includes(cat.id)}
                onToggle={() => toggleStar.mutate({ categoryId: cat.id, isStarred: starredCats.includes(cat.id) })}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{cat.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {hasBudget
                    ? `${formatCurrency(spent)} / ${formatCurrency(budget.amount, budget.currency)}`
                    : `Gastado: ${formatCurrency(spent)}`}
                </p>
              </div>

              {/* Inline edit controls */}
              {isEditing ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Input
                    ref={inputRef}
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveEdit(cat.id)
                      if (e.key === "Escape") cancelEdit()
                    }}
                    onBlur={() => void saveEdit(cat.id)}
                    className="w-24 h-7 text-xs tabular-nums"
                    placeholder="0.00"
                  />
                  <button
                    onMouseDown={(e) => { e.preventDefault(); void saveEdit(cat.id) }}
                    className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center hover:bg-emerald-200 dark:hover:bg-emerald-800/60 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  </button>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); cancelEdit() }}
                    className="h-6 w-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 shrink-0">
                  {hasBudget && (
                    <span className={cn("text-sm font-semibold tabular-nums", getPctColor(pct))}>
                      {pct.toFixed(0)}%
                    </span>
                  )}
                  <button
                    onClick={() => startEdit(cat.id)}
                    title="Editar presupuesto"
                    className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  {hasBudget && (
                    <button
                      onClick={() => void handleDelete(cat.id)}
                      title="Eliminar presupuesto"
                      className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Row 2: progress bar + label */}
            {hasBudget ? (
              <div className="space-y-1">
                <Progress
                  value={pct}
                  className={cn("h-1.5", getProgressColor(pct))}
                />
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {formatCurrency(spent, budget.currency)} gastado
                  </span>
                  <span className={cn("text-[10px] font-medium tabular-nums", getPctColor(pct))}>
                    {pct >= 100
                      ? `Excedido por ${formatCurrency(spent - budget.amount, budget.currency)}`
                      : `Quedan ${formatCurrency(budget.amount - spent, budget.currency)}`}
                  </span>
                </div>
                {/* Snooze controls (Feature C) */}
                <div className="flex justify-end pt-0.5">
                  <SnoozeControls categoryId={cat.id} />
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground italic">
                Sin límite — haz clic en el lápiz para definir un presupuesto
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
