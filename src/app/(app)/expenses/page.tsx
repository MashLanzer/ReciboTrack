"use client"

import { Suspense, useState, useEffect } from "react"
import { ExpenseList }           from "@/components/expenses/expense-list"
import { ExpenseCalendar }       from "@/components/expenses/expense-calendar"
import { ExpenseThreads }        from "@/components/expenses/expense-threads"
import { ExpenseGridView }       from "@/components/expenses/expense-grid-view"
import { FlaggedExpensesPanel }  from "@/components/expenses/flagged-expenses-panel"
import { ArchivedExpensesSection } from "@/components/expenses/archived-expenses-section"
import { Skeleton }              from "@/components/ui/skeleton"
import { ViewToggle, type ViewMode } from "@/components/expenses/view-toggle"
import { ShareSummary }          from "@/components/expenses/share-summary"
import { ImportStatementButton } from "@/components/expenses/import-statement-button"

const STORAGE_KEY = "rbt_expenses_view"

function isViewMode(v: unknown): v is ViewMode {
  return v === "list" || v === "cal" || v === "threads" || v === "grid"
}

function ExpenseListFallback() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  )
}

// ─── View panel — parent passes key={view} to force remount on switch ────────

function ViewPanel({ view }: { view: ViewMode }) {
  return (
    <div className="animate-[fadeSlideUp_0.18s_ease-out_both]">
      <Suspense fallback={<ExpenseListFallback />}>
        {view === "cal"     ? <ExpenseCalendar /> :
         view === "threads" ? <ExpenseThreads /> :
         view === "grid"    ? <ExpenseGridView /> :
                              <ExpenseList />}
      </Suspense>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [view, setViewState] = useState<ViewMode>("list")

  // Restore persisted view on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (isViewMode(saved)) setViewState(saved)
    } catch { /* ignore */ }
  }, [])

  function setView(v: ViewMode) {
    setViewState(v)
    try { localStorage.setItem(STORAGE_KEY, v) } catch { /* ignore */ }
  }

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
          <ViewToggle current={view} onChange={setView} />
        </div>
      </div>

      {/* Flagged expenses panel */}
      <div className="mb-4">
        <FlaggedExpensesPanel />
      </div>

      {/* Active view — key forces remount → CSS animation fires on every switch */}
      <ViewPanel key={view} view={view} />

      {/* Archived expenses */}
      <div className="mt-6">
        <ArchivedExpensesSection />
      </div>
    </div>
  )
}
