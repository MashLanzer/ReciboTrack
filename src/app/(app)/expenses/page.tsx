import { Suspense } from "react"
import { ExpenseList } from "@/components/expenses/expense-list"
import { ExpenseCalendar } from "@/components/expenses/expense-calendar"
import { ScanFab } from "@/components/receipt-scanner/scan-fab"
import { Skeleton } from "@/components/ui/skeleton"
import { ViewToggle } from "@/components/expenses/view-toggle"
import { ShareSummary } from "@/components/expenses/share-summary"

function ExpenseListFallback() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  )
}

interface ExpensesPageProps {
  searchParams: Promise<{ view?: string }>
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = await searchParams
  const view = params.view === "cal" ? "cal" : "list"

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl">Gastos</h1>
          <p className="text-sm text-muted-foreground mt-1">Historial de todos tus gastos</p>
        </div>
        <div className="flex items-center gap-2">
          <ShareSummary />
          <ViewToggle current={view} />
        </div>
      </div>

      {view === "cal" ? (
        <Suspense fallback={<ExpenseListFallback />}>
          <ExpenseCalendar />
        </Suspense>
      ) : (
        <Suspense fallback={<ExpenseListFallback />}>
          <ExpenseList />
        </Suspense>
      )}

      <ScanFab />
    </div>
  )
}
