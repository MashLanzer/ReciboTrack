"use client"

import { Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { IncomeBalance } from "@/components/dashboard/income-balance"
import { QuickExpenses } from "@/components/dashboard/quick-expenses"
import { WeeklyWidget } from "@/components/dashboard/weekly-widget"
import { MultiCurrencyBanner } from "@/components/dashboard/multicurrency-banner"
import { RecurringBanner } from "@/components/expenses/recurring-banner"
import { ScanFab } from "@/components/receipt-scanner/scan-fab"
import { ReceiptScanner } from "@/components/receipt-scanner/receipt-scanner"
import { useUIStore } from "@/stores/ui-store"

export default function DashboardPage() {
  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-3">
      <Suspense>
        <ScanParamHandler />
      </Suspense>
      <RecurringBanner />
      <QuickExpenses />
      <WeeklyWidget />
      <MultiCurrencyBanner />
      <DashboardStats />
      <IncomeBalance />
      <ScanFab />
      <ReceiptScanner />
    </div>
  )
}

function ScanParamHandler() {
  const searchParams = useSearchParams()
  const { setScannerOpen } = useUIStore()

  useEffect(() => {
    if (searchParams.get("scan") === "1") {
      setScannerOpen(true)
    }
  }, [searchParams, setScannerOpen])

  return null
}
