import { BudgetOverview } from "@/components/dashboard/budget-overview"
import { CategoryBudgetsClient } from "@/components/budgets/category-budgets-client"
import { TripLinkCard } from "@/components/budgets/trip-link-card"
import { NotificationSettingsCard } from "@/components/notifications/notification-settings-card"

export default function BudgetsPage() {
  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-10">
      <div>
        <h1 className="font-serif text-2xl">Presupuestos</h1>
        <p className="text-sm text-muted-foreground mt-1">Control mensual y por viaje / evento</p>
      </div>

      <CategoryBudgetsClient />

      <BudgetOverview />

      <div className="border-t pt-6">
        <TripLinkCard />
      </div>

      <div className="border-t pt-6">
        <NotificationSettingsCard />
      </div>
    </div>
  )
}
