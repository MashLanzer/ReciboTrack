import { BudgetOverview } from "@/components/dashboard/budget-overview"

export default function BudgetsPage() {
  return (
    <div className="container max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="font-serif text-2xl">Presupuestos</h1>
        <p className="text-sm text-muted-foreground mt-1">Control mensual por categoría</p>
      </div>
      <BudgetOverview />
    </div>
  )
}
