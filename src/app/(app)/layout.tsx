import { TopNav } from "@/components/navigation/top-nav"
import { BottomNav } from "@/components/navigation/bottom-nav"
import { AuthGuard } from "@/components/shared/auth-guard"
import { NotificationInit } from "@/components/shared/notification-init"
import { UpdateBanner } from "@/components/shared/update-banner"
import { CommandPalette } from "@/components/shared/command-palette"
import { Onboarding } from "@/components/shared/onboarding"
import { AccentColorProvider } from "@/components/shared/accent-color-provider"
import { OfflineBanner } from "@/components/shared/offline-banner"
import { AnomalyDetector } from "@/components/shared/anomaly-detector"
import { CategoryLimitsWatcher } from "@/components/shared/category-limits-watcher"
import { ReceiptScanner } from "@/components/receipt-scanner/receipt-scanner"
import { QuickAddSheet } from "@/components/expenses/quick-add-sheet"
import { AddIncomeDialog } from "@/components/income/add-income-dialog"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <OfflineBanner />
      <NotificationInit />
      <AccentColorProvider />
      <Onboarding />
      <AnomalyDetector />
      <CategoryLimitsWatcher />
      <CommandPalette />
      {/* Global overlays — scanner + quick-add + income available from any page */}
      <ReceiptScanner />
      <QuickAddSheet />
      <AddIncomeDialog />
      <div className="flex flex-col min-h-screen">
        <TopNav />
        <UpdateBanner />
        <main className="flex-1 pb-20 md:pb-0">
          {children}
        </main>
        <BottomNav />
      </div>
    </AuthGuard>
  )
}
