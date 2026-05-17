import { Suspense } from "react"
import { ExpenseList } from "@/components/expenses/expense-list"
import { ExpenseCalendar } from "@/components/expenses/expense-calendar"
import { ExpenseThreads } from "@/components/expenses/expense-threads"
import { ExpenseGridView } from "@/components/expenses/expense-grid-view"
import { FlaggedExpensesPanel } from "@/components/expenses/flagged-expenses-panel"
import { ArchivedExpensesSection } from "@/components/expenses/archived-expenses-section"
import { Skeleton } from "@/components/ui/skeleton"
import { ViewToggle, type ViewMode } from "@/components/expenses/view-toggle"
import { ShareSummary } from "@/components/expenses/share-summary"
import { ImportStatementButton } from "@/components/expenses/import-statement-button"

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
  const rawView = params.view
  const view: ViewMode =
    rawView === "cal" ? "cal" :
    rawView === "threads" ? "threads" :
    rawView === "grid" ? "grid" :
    "list"

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl">Gastos</h1>
          <p className="text-sm text-muted-foreground mt-1">Historial de todos tus gastos</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportStatementButton />
          <ShareSummary />
          <ViewToggle current={view} />
        </div>
      </div>

      {/* Flagged expenses panel (Feature B) */}
      <div className="mb-4">
        <FlaggedExpensesPanel />
      </div>

      {view === "cal" ? (
        <Suspense fallback={<ExpenseListFallback />}>
          <ExpenseCalendar />
        </Suspense>
      ) : view === "threads" ? (
        <Suspense fallback={<ExpenseListFallback />}>
          <ExpenseThreads />
        </Suspense>
      ) : view === "grid" ? (
        <Suspense fallback={<ExpenseListFallback />}>
          <ExpenseGridView />
        </Suspense>
      ) : (
        <Suspense fallback={<ExpenseListFallback />}>
          <ExpenseList />
        </Suspense>
      )}

      {/* Archived expenses (Feature A) */}
      <div className="mt-6">
        <ArchivedExpensesSection />
      </div>
    </div>
  )
}
