import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { BudgetOverview } from "@/components/dashboard/budget-overview"
import { CategoryBudgetsClient } from "@/components/budgets/category-budgets-client"
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
        <Link href="/trips">
          <div className="flex items-center justify-between rounded-2xl border p-4 hover:bg-accent/40 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✈️</span>
              <div>
                <p className="font-semibold">Viajes y eventos</p>
                <p className="text-sm text-muted-foreground">Presupuestos por viaje</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </Link>
      </div>

      <div className="border-t pt-6">
        <NotificationSettingsCard />
      </div>
    </div>
  )
}
