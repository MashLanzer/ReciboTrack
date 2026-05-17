"use client"

import { useUIStore } from "@/stores/ui-store"
import { ExpenseEditDialog } from "./expense-edit-dialog"

/**
 * Global mount — listens to `editExpense` in the UI store and opens the
 * edit dialog from anywhere in the app (dashboard widgets, etc.).
 */
export function GlobalExpenseEditDialog() {
  const { editExpense, setEditExpense } = useUIStore()

  return (
    <ExpenseEditDialog
      expense={editExpense}
      onClose={() => setEditExpense(null)}
    />
  )
}
