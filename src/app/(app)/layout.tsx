import { TopNav } from "@/components/navigation/top-nav"
import { BottomNav } from "@/components/navigation/bottom-nav"
import { AuthGuard } from "@/components/shared/auth-guard"
import { AppLock } from "@/components/shared/app-lock"
import { NotificationInit } from "@/components/shared/notification-init"
import { UpdateBanner } from "@/components/shared/update-banner"
import { CommandPalette } from "@/components/shared/command-palette"
import { Onboarding } from "@/components/shared/onboarding"
import { AccentColorProvider } from "@/components/shared/accent-color-provider"
import { OfflineBanner } from "@/components/shared/offline-banner"
import { AnomalyDetector } from "@/components/shared/anomaly-detector"
import { CategoryLimitsWatcher } from "@/components/shared/category-limits-watcher"
import { WatchlistAlertsWatcher } from "@/components/shared/watchlist-alerts-watcher"
import { BudgetAlertWatcher } from "@/components/notifications/budget-alert-watcher"
import { ReceiptScanner } from "@/components/receipt-scanner/receipt-scanner"
import { QuickAddSheet } from "@/components/expenses/quick-add-sheet"
import { AddIncomeDialog } from "@/components/income/add-income-dialog"
import { GlobalExpenseEditDialog } from "@/components/expenses/global-expense-edit-dialog"
import { RoundUpWatcher } from "@/components/expenses/round-up-watcher"
import { AutomationWatcher } from "@/components/automations/automation-watcher"
import { GeolocationWatcher } from "@/components/notifications/geolocation-watcher"
import { PullToRefresh } from "@/components/shared/pull-to-refresh"
import { ScrollToTop } from "@/components/shared/scroll-to-top"
import { PageTransition } from "@/components/shared/page-transition"
import { RealtimeSyncProvider } from "@/components/shared/realtime-sync-provider"
import { KeyboardShortcutsProvider } from "@/components/shared/keyboard-shortcuts-provider"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppLock>
      <OfflineBanner />
      <NotificationInit />
      <AccentColorProvider />
      <Onboarding />
      <AnomalyDetector />
      <CategoryLimitsWatcher />
      <WatchlistAlertsWatcher />
      <BudgetAlertWatcher />
      <CommandPalette />
      {/* Global overlays — scanner + quick-add + income available from any page */}
      <ReceiptScanner />
      <QuickAddSheet />
      <AddIncomeDialog />
      <GlobalExpenseEditDialog />
      <RoundUpWatcher />
      <AutomationWatcher />
      <GeolocationWatcher />
      <RealtimeSyncProvider />
      <KeyboardShortcutsProvider>
      <div className="flex flex-col min-h-screen">
        <TopNav />
        <UpdateBanner />
        <PullToRefresh />
        <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          <PageTransition>{children}</PageTransition>
        </main>
        <ScrollToTop />
        <BottomNav />
      </div>
      </KeyboardShortcutsProvider>
      </AppLock>
    </AuthGuard>
  )
}
