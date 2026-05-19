"use client"

import { Suspense, useState, useEffect, useRef } from "react"
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

// ─── View panel ───────────────────────────────────────────────────────────────
// #4 — Cada vista se monta la primera vez que se visita y permanece montada.
// Las vistas inactivas se ocultan con CSS (hidden) para preservar scroll y estado.
// Esto evita el remount completo que antes causaba pérdida de scroll position.

const ALL_VIEWS: ViewMode[] = ["list", "cal", "threads", "grid"]

function ViewPanel({ view }: { view: ViewMode }) {
  // Registra qué vistas han sido visitadas → una vez montada, nunca se desmonta
  const visitedRef = useRef<Set<ViewMode>>(new Set([view]))
  const [visited, setVisited] = useState<Set<ViewMode>>(visitedRef.current)

  useEffect(() => {
    if (!visitedRef.current.has(view)) {
      const next = new Set(visitedRef.current)
      next.add(view)
      visitedRef.current = next
      setVisited(next)
    }
  }, [view])

  return (
    <>
      {ALL_VIEWS.map((v) => (
        <div
          key={v}
          className={v === view ? "animate-[fadeSlideUp_0.18s_ease-out_both]" : "hidden"}
        >
          {visited.has(v) && (
            <Suspense fallback={<ExpenseListFallback />}>
              {v === "cal"     ? <ExpenseCalendar /> :
               v === "threads" ? <ExpenseThreads /> :
               v === "grid"    ? <ExpenseGridView /> :
                                 <ExpenseList />}
            </Suspense>
          )}
        </div>
      ))}
    </>
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

      <ViewPanel view={view} />

      {/* Archived expenses */}
      <div className="mt-6">
        <ArchivedExpensesSection />
      </div>
    </div>
  )
}
