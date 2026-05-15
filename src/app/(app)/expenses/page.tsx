import { ExpenseList } from "@/components/expenses/expense-list"
import { ScanFab } from "@/components/receipt-scanner/scan-fab"

export default function ExpensesPage() {
  return (
    <div className="container max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="font-serif text-2xl">Gastos</h1>
        <p className="text-sm text-muted-foreground mt-1">Historial de todos tus gastos</p>
      </div>
      <ExpenseList />
      <ScanFab />
    </div>
  )
}
