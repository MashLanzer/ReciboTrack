"use client"

import { useState } from "react"
import type { Expense } from "@/types"
import type { CategoryDoc } from "@/types"
import { formatCurrency, formatDate, toDate } from "@/lib/utils"
import { ExpenseDetailDialog } from "./expense-detail-dialog"
import { ExpenseEditDialog } from "./expense-edit-dialog"
import { cn } from "@/lib/utils"

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
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center text-muted-foreground">
        <p className="text-sm">No hay gastos para mostrar</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {expenses.map((expense) => {
          const cat = categories.find((c) => c.id === expense.category)
          return (
            <button
              key={expense.id}
              onClick={() => setDetailExpense(expense)}
              className={cn(
                "group relative flex flex-col gap-2 rounded-xl border bg-card p-3 text-left",
                "transition-all hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              {/* Category icon */}
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
                style={{ backgroundColor: `${cat?.color ?? "#6b7280"}20` }}
              >
                {cat?.icon ?? "📦"}
              </div>

              {/* Merchant */}
              <p className="text-xs font-semibold leading-tight truncate w-full">
                {expense.merchant}
              </p>

              {/* Amount */}
              <p className="tabular-nums text-sm font-bold text-primary">
                {formatCurrency(expense.total, expense.currency)}
              </p>

              {/* Date + category */}
              <div className="flex flex-col gap-0.5">
                <p className="text-[10px] text-muted-foreground">
                  {formatDate(toDate(expense.date), "dd MMM")}
                </p>
                {cat && (
                  <p className="text-[10px] text-muted-foreground truncate">{cat.name}</p>
                )}
              </div>

              {/* Tags */}
              {expense.tags?.length > 0 && (
                <div className="flex flex-wrap gap-0.5">
                  {expense.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Receipt image indicator */}
              {expense.receiptImageUrl && (
                <div
                  className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary/15 flex items-center justify-center"
                  title="Tiene foto de recibo"
                >
                  <span className="text-[8px]">📷</span>
                </div>
              )}
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
