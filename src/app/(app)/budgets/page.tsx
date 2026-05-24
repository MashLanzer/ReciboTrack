import { format } from "date-fns"
import { es } from "date-fns/locale"
import { BudgetOverview } from "@/components/dashboard/budget-overview"
import { CategoryBudgetsClient } from "@/components/budgets/category-budgets-client"
import { TripLinkCard } from "@/components/budgets/trip-link-card"
import { ErrorBoundary } from "@/components/ui/error-boundary"

export default function BudgetsPage() {
  const monthLabel = format(new Date(), "MMMM yyyy", { locale: es })

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-end gap-3">
        <div>
          <h1 className="font-serif text-2xl">Presupuestos</h1>
          <p className="text-sm text-muted-foreground mt-1">Control mensual y por viaje / evento</p>
        </div>
        <span className="mb-0.5 shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold capitalize text-primary">
          {monthLabel}
        </span>
      </div>

      {/* #19 — ErrorBoundary por sección para aislar fallos */}
      <ErrorBoundary label="Presupuestos por categoría">
        <CategoryBudgetsClient />
      </ErrorBoundary>

      <ErrorBoundary label="Resumen de presupuesto">
        <BudgetOverview />
      </ErrorBoundary>

      <div className="relative pt-6">
        <div className="absolute inset-x-0 top-0 flex items-center gap-3">
          <div className="h-px flex-1 bg-border/60" />
          <span className="shrink-0 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
            Viajes &amp; Eventos
          </span>
          <div className="h-px flex-1 bg-border/60" />
        </div>
        <ErrorBoundary label="Viajes y eventos" compact>
          <TripLinkCard />
        </ErrorBoundary>
      </div>

    </div>
  )
}
