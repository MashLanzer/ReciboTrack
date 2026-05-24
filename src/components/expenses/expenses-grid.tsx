"use client"

import { useState } from "react"
import type { Expense } from "@/types"
import type { CategoryDoc } from "@/types"
import { formatCurrency, formatDate, toDate } from "@/lib/utils"
import { ExpenseDetailDialog } from "./expense-detail-dialog"
import { ExpenseEditDialog } from "./expense-edit-dialog"
import { cn } from "@/lib/utils"
import { Receipt } from "lucide-react"

interface ExpensesGridProps {
  expenses: Expense[]
  categories: CategoryDoc[]
  onDelete: (id: string) => void
}

export function ExpensesGrid({ expenses, categories, onDelete }: ExpensesGridProps) {
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center text-muted-foreground">
        <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center">
          <Receipt className="h-7 w-7 opacity-30" />
        </div>
        <div>
          <p className="text-sm font-semibold">Sin gastos</p>
          <p className="text-xs mt-0.5 opacity-60">No hay resultados para mostrar</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {expenses.map((expense, i) => {
          const cat = categories.find((c) => c.id === expense.category)
          const catColor = cat?.color ?? "#6b7280"

          return (
            <button
              key={expense.id}
              onClick={() => setDetailExpense(expense)}
              className={cn(
                "stagger-item group relative flex flex-col gap-2 rounded-xl border bg-card p-3 pt-3.5 text-left overflow-hidden",
                "transition-all duration-150 hover:shadow-lg hover:border-transparent hover:-translate-y-1",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              style={{ "--i": i } as React.CSSProperties}
            >
              {/* Top color stripe */}
              <div
                className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                style={{ backgroundColor: catColor }}
              />

              {/* Category icon */}
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-xl shrink-0"
                style={{ backgroundColor: `${catColor}20` }}
              >
                {cat?.icon ?? "📦"}
              </div>

              {/* Merchant */}
              <p className="text-xs font-bold leading-tight truncate w-full">
                {expense.merchant}
              </p>

              {/* Amount — destructive like list view */}
              <p className="tabular-nums text-sm font-black text-destructive leading-tight">
                -{formatCurrency(expense.total, expense.currency)}
              </p>

              {/* Date + category */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[10px] text-muted-foreground">
                  {formatDate(toDate(expense.date), "dd MMM")}
                </p>
                {cat && (
                  <>
                    <span className="text-muted-foreground/40 text-[10px]">·</span>
                    <p className="text-[10px] text-muted-foreground truncate">{cat.name}</p>
                  </>
                )}
              </div>

              {/* Tags */}
              {expense.tags?.length > 0 && (
                <div className="flex flex-wrap gap-0.5">
                  {expense.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Badges — receipt + recurring */}
              <div className="absolute top-2.5 right-2 flex items-center gap-1">
                {expense.recurringId && (
                  <span className="text-[10px]" title="Recurrente">🔄</span>
                )}
                {expense.receiptImageUrl && (
                  <span className="text-[10px]" title="Foto de recibo">📷</span>
                )}
                {expense.flagged && (
                  <span className="text-[10px]" title="Pendiente">🔖</span>
                )}
              </div>

              {/* Hover overlay */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl"
                style={{ background: `linear-gradient(135deg, ${catColor}08, transparent)` }}
              />
            </button>
          )
        })}
      </div>

      <ExpenseDetailDialog
        expense={detailExpense}
        category={categories.find((c) => c.id === detailExpense?.category)}
        onClose={() => setDetailExpense(null)}
        onEdit={() => { setEditExpense(detailExpense); setDetailExpense(null) }}
        onDelete={() => detailExpense && onDelete(detailExpense.id)}
      />
      <ExpenseEditDialog expense={editExpense} onClose={() => setEditExpense(null)} />
    </>
  )
}
