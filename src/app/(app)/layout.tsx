import { TopNav } from "@/components/navigation/top-nav"
import { BottomNav } from "@/components/navigation/bottom-nav"
import { AuthGuard } from "@/components/shared/auth-guard"
import { NotificationInit } from "@/components/shared/notification-init"
import { UpdateBanner } from "@/components/shared/update-banner"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <NotificationInit />
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
