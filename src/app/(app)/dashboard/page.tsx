"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { IncomeBalance } from "@/components/dashboard/income-balance"
import { QuickExpenses } from "@/components/dashboard/quick-expenses"
import { WeeklyWidget } from "@/components/dashboard/weekly-widget"
import { MultiCurrencyBanner } from "@/components/dashboard/multicurrency-banner"
import { RecurringBanner } from "@/components/expenses/recurring-banner"
import { useUIStore } from "@/stores/ui-store"
import { cn } from "@/lib/utils"
import { LayoutDashboard, CalendarDays, BarChart2 } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "resumen" | "semana" | "analisis"

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "resumen",  label: "Resumen",      icon: LayoutDashboard },
  { id: "semana",   label: "Esta semana",  icon: CalendarDays    },
  { id: "analisis", label: "Análisis",     icon: BarChart2       },
]

const TAB_KEY = "rt-dashboard-tab"

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("resumen")

  // Restore persisted tab after mount (avoid SSR mismatch)
  useEffect(() => {
    const saved = localStorage.getItem(TAB_KEY) as Tab | null
    if (saved && TABS.some((t) => t.id === saved)) setTab(saved)
  }, [])

  function switchTab(next: Tab) {
    setTab(next)
    try { localStorage.setItem(TAB_KEY, next) } catch { /**/ }
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 pt-4 pb-24 space-y-4">
      {/* Scan-param handler (reads ?scan=1) */}
      <Suspense>
        <ScanParamHandler />
      </Suspense>

      {/* Recurring alert — always above the fold */}
      <RecurringBanner />

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Secciones del dashboard"
        className="flex items-center gap-1 bg-muted rounded-xl p-1"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => switchTab(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-lg transition-all",
              tab === id
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground/80"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab panels ───────────────────────────────────────────────────── */}

      {/* Resumen: balance del mes + divisas */}
      {tab === "resumen" && (
        <div className="space-y-3">
          <IncomeBalance />
          <MultiCurrencyBanner />
        </div>
      )}

      {/* Esta semana: acción rápida + vista semanal */}
      {tab === "semana" && (
        <div className="space-y-3">
          <QuickExpenses />
          <WeeklyWidget />
        </div>
      )}

      {/* Análisis: gráficas, categorías, proyecciones */}
      {tab === "analisis" && (
        <div className="space-y-3">
          <DashboardStats />
        </div>
      )}

    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
