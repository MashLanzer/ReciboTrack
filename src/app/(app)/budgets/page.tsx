import { BudgetOverview } from "@/components/dashboard/budget-overview"
import { CategoryBudgetsClient } from "@/components/budgets/category-budgets-client"
import { TripLinkCard } from "@/components/budgets/trip-link-card"
import { ErrorBoundary } from "@/components/ui/error-boundary"

export default function BudgetsPage() {
  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="font-serif text-2xl">Presupuestos</h1>
        <p className="text-sm text-muted-foreground mt-1">Control mensual y por viaje / evento</p>
      </div>

      {/* #19 — ErrorBoundary por sección para aislar fallos */}
      <ErrorBoundary label="Presupuestos por categoría">
        <CategoryBudgetsClient />
      </ErrorBoundary>

      <ErrorBoundary label="Resumen de presupuesto">
        <BudgetOverview />
      </ErrorBoundary>

      <div className="border-t pt-6">
        <ErrorBoundary label="Viajes y eventos" compact>
          <TripLinkCard />
        </ErrorBoundary>
      </div>

    </div>
  )
}
