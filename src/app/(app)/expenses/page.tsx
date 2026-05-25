"use client"

import { Suspense, useState, useEffect, useRef } from "react"
import { ExpenseList }           from "@/components/expenses/expense-list"
import { ExpenseCalendar }       from "@/components/expenses/expense-calendar"
import { ExpenseThreads }        from "@/components/expenses/expense-threads"
import { ExpenseGridView }       from "@/components/expenses/expense-grid-view"
import { FlaggedExpensesPanel }  from "@/components/expenses/flagged-expenses-panel"
import { ArchivedExpensesSection } from "@/components/expenses/archived-expenses-section"
import { Skeleton }              from "@/components/ui/skeleton"
import { Button }                from "@/components/ui/button"
import { ViewToggle, type ViewMode } from "@/components/expenses/view-toggle"
import { ShareSummary }          from "@/components/expenses/share-summary"
import { ImportStatementButton } from "@/components/expenses/import-statement-button"
import { BankImportDialog }      from "@/components/expenses/bank-import-dialog"
import { useUIPrefs }            from "@/hooks/use-ui-prefs"
import { useExportExpensesCSV }  from "@/hooks/use-export"
import { Download, Building2 }   from "lucide-react"

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
  const { prefs, setPref } = useUIPrefs()
  const view: ViewMode = isViewMode(prefs.expensesView) ? prefs.expensesView : "list"
  const exportCSV = useExportExpensesCSV()
  const [exporting, setExporting] = useState(false)
  const [bankImportOpen, setBankImportOpen] = useState(false)

  function setView(v: ViewMode) {
    setPref("expensesView", v)
  }

  async function handleExport() {
    setExporting(true)
    try {
      await exportCSV()
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl">Gastos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Historial de todos tus gastos</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Acciones secundarias — sólo en desktop (son features avanzadas) */}
          <div className="hidden md:flex items-center gap-2">
            <ImportStatementButton />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setBankImportOpen(true)}
              title="Importar banco"
              aria-label="Importar extracto bancario"
            >
              <Building2 className="h-4 w-4" />
            </Button>
            <ShareSummary />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleExport}
              disabled={exporting}
            >
              <Download className="h-4 w-4" />
              {exporting ? "Exportando…" : "Exportar CSV"}
            </Button>
          </div>
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

      <BankImportDialog open={bankImportOpen} onClose={() => setBankImportOpen(false)} />
    </div>
  )
}
