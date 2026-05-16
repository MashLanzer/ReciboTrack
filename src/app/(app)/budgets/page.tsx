import { BudgetOverview } from "@/components/dashboard/budget-overview"
import { TravelBudgets } from "@/components/dashboard/travel-budgets"

export default function BudgetsPage() {
  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-10">
      <div>
        <h1 className="font-serif text-2xl">Presupuestos</h1>
        <p className="text-sm text-muted-foreground mt-1">Control mensual y por viaje / evento</p>
      </div>
      <BudgetOverview />
      <div className="border-t pt-6">
        <TravelBudgets />
      </div>
    </div>
  )
}
