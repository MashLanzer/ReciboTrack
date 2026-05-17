"use client"

import { Suspense, useEffect, useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { ScanLine, Plus, BarChart2, ChevronDown, ChevronUp, Zap } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { HeroBalanceCard }    from "@/components/dashboard/hero-balance-card"
import { KPIBento }           from "@/components/dashboard/kpi-bento"
import { WeekSparkCard }      from "@/components/dashboard/week-spark-card"
import { TopCategoriesCard }  from "@/components/dashboard/top-categories-card"
import { ActivityFeed }       from "@/components/dashboard/activity-feed"
import { DashboardStats }     from "@/components/dashboard/dashboard-stats"
import { MultiCurrencyBanner } from "@/components/dashboard/multicurrency-banner"
import { RecurringBanner }    from "@/components/expenses/recurring-banner"
import { GoalsWidget }        from "@/components/dashboard/goals-widget"
import { useUIStore }         from "@/stores/ui-store"
import { useAuth }            from "@/hooks/use-auth"
import { cn }                 from "@/lib/utils"

// ─── Greeting ─────────────────────────────────────────────────────────────────

function greeting(name?: string | null) {
  const h = new Date().getHours()
  const saludo = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches"
  return name ? `${saludo}, ${name.split(" ")[0]}` : saludo
}

// ─── Quick action button ───────────────────────────────────────────────────────

function QuickBtn({
  icon: Icon,
  label,
  onClick,
  accent = false,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex flex-col items-center justify-center gap-1.5 rounded-2xl border py-3.5 text-[11px] font-bold transition-all active:scale-95",
        accent
          ? "border-primary/30 bg-primary/8 text-primary hover:bg-primary/12"
          : "border-border bg-card text-foreground hover:bg-accent/60"
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  )
}

// ─── Section divider ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-0.5">
      {children}
    </p>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const { setScannerOpen, setQuickAddOpen } = useUIStore()
  const [showAnalytics, setShowAnalytics] = useState(false)
  const dateLabel = useMemo(() => format(new Date(), "EEEE d 'de' MMMM", { locale: es }), [])

  return (
    <div className="container max-w-2xl mx-auto px-4 pt-5 pb-28 space-y-5">

      {/* ── Scan param handler ─────────────────────────────────────────── */}
      <Suspense>
        <ScanParamHandler />
      </Suspense>

      {/* ── Greeting header ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xl font-black tracking-tight leading-tight">
            {greeting(user?.displayName)}
          </p>
          <p className="text-[11px] text-muted-foreground capitalize mt-0.5">{dateLabel}</p>
        </div>
        {/* Account badge */}
        <AccountBadge />
      </div>

      {/* ── Alerts ────────────────────────────────────────────────────── */}
      <RecurringBanner />
      <MultiCurrencyBanner />

      {/* ── Hero balance ──────────────────────────────────────────────── */}
      <HeroBalanceCard />

      {/* ── Quick actions ─────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <QuickBtn
          icon={ScanLine}
          label="Escanear"
          onClick={() => setScannerOpen(true)}
          accent
        />
        <QuickBtn
          icon={Plus}
          label="Añadir"
          onClick={() => setQuickAddOpen(true)}
        />
        <QuickBtn
          icon={Zap}
          label="Rápido"
          onClick={() => setQuickAddOpen(true)}
        />
      </div>

      {/* ── KPI bento ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <SectionLabel>Métricas</SectionLabel>
        <KPIBento />
      </div>

      {/* ── Week spark ────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <SectionLabel>Esta semana</SectionLabel>
        <WeekSparkCard />
      </div>

      {/* ── Top categories ────────────────────────────────────────────── */}
      <div className="space-y-2">
        <SectionLabel>Distribución del mes</SectionLabel>
        <TopCategoriesCard />
      </div>

      {/* ── Goals widget ──────────────────────────────────────────────── */}
      <GoalsWidget />

      {/* ── Activity feed ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <SectionLabel>Actividad reciente</SectionLabel>
        <ActivityFeed />
      </div>

      {/* ── Analytics toggle ──────────────────────────────────────────── */}
      <button
        onClick={() => setShowAnalytics(s => !s)}
        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-accent/30 transition-all"
      >
        <BarChart2 className="h-4 w-4" />
        {showAnalytics ? "Ocultar análisis" : "Ver análisis completo"}
        {showAnalytics
          ? <ChevronUp className="h-4 w-4 ml-auto" />
          : <ChevronDown className="h-4 w-4 ml-auto" />}
      </button>

      {showAnalytics && (
        <div className="space-y-2">
          <SectionLabel>Análisis detallado</SectionLabel>
          <DashboardStats />
        </div>
      )}

    </div>
  )
}

// ─── Account badge ────────────────────────────────────────────────────────────

function AccountBadge() {
  const { activeAccount, setActiveAccount } = useUIStore()
  return (
    <button
      onClick={() => setActiveAccount(activeAccount === "personal" ? "business" : "personal")}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold border transition-all",
        activeAccount === "business"
          ? "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400"
          : "border-primary/30 bg-primary/8 text-primary"
      )}
    >
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        activeAccount === "business" ? "bg-violet-500" : "bg-primary"
      )} />
      {activeAccount === "business" ? "Negocio" : "Personal"}
    </button>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScanParamHandler() {
  const searchParams = useSearchParams()
  const { setScannerOpen } = useUIStore()
  useEffect(() => {
    if (searchParams.get("scan") === "1") setScannerOpen(true)
  }, [searchParams, setScannerOpen])
  return null
}
