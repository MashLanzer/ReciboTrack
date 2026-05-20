"use client"

import { Suspense, useEffect, useState, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { ScanLine, Plus, BarChart2, Search, LayoutDashboard, Zap } from "lucide-react"
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
import { MemoriesWidget }     from "@/components/dashboard/memories-widget"
import { AnniversaryWidget }  from "@/components/dashboard/anniversary-widget"
import { HighlightsWidget }   from "@/components/dashboard/highlights-widget"
import { PinnedItemsBar }     from "@/components/dashboard/pinned-items-bar"
import { SwipeableFeed }      from "@/components/dashboard/swipeable-feed"
import { QuickStatsBlock, QuickRecentBlock } from "@/components/dashboard/quick-mode-extras"
import { MonthlyRecapCard }   from "@/components/dashboard/monthly-recap-card"
import { TodayWidget }        from "@/components/dashboard/today-widget"
import { CollapsibleContent, CollapsibleChevron } from "@/components/ui/collapsible"
import { useUIStore }         from "@/stores/ui-store"
import { useAuth }            from "@/hooks/use-auth"
import { useUIPrefs }         from "@/hooks/use-ui-prefs"
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
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 px-0.5">
      {children}
    </p>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const { setScannerOpen, setQuickAddOpen, setCommandOpen, activeAccount } = useUIStore()
  const queryClient = useQueryClient()
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showRecap, setShowRecap] = useState(false)
  const [showMemories, setShowMemories] = useState(false)
  const { prefs, setPref } = useUIPrefs()
  const dashMode = prefs.dashMode
  const setDashMode = (m: "normal" | "quick") => setPref("dashMode", m)
  const dateLabel = useMemo(() => format(new Date(), "EEEE d 'de' MMMM", { locale: es }), [])

  // #10 — Invalidar queries al cambiar de cuenta personal/negocio
  // Asegura que todos los widgets muestren datos de la cuenta correcta
  useEffect(() => {
    queryClient.invalidateQueries()
  }, [activeAccount, queryClient])

  return (
    <div className="container max-w-2xl mx-auto px-4 pt-5 pb-28 space-y-5">

      {/* ── Scan param handler ─────────────────────────────────────────── */}
      <Suspense fallback={null}>
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

      {/* ── Dashboard mode toggle ─────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted self-start">
        <button
          onClick={() => setDashMode("normal")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
            dashMode === "normal"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          Normal
        </button>
        <button
          onClick={() => setDashMode("quick")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
            dashMode === "quick"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Zap className="h-3.5 w-3.5" />
          Rápida
        </button>
      </div>

      {/* ── Quick mode: swipeable feed + extras ──────────────────────── */}
      {dashMode === "quick" && (
        <div className="space-y-3">
          <SectionLabel>Vista rápida</SectionLabel>
          <SwipeableFeed />
          <QuickStatsBlock />
          <QuickRecentBlock />
        </div>
      )}

      {dashMode === "normal" && (<>

      {/* ── Alerts ────────────────────────────────────────────────────── */}
      <RecurringBanner />
      <MultiCurrencyBanner />

      {/* ── Today widget ──────────────────────────────────────────────── */}
      <TodayWidget />

      {/* ── Hero balance ──────────────────────────────────────────────── */}
      <HeroBalanceCard />

      {/* ── Monthly recap (collapsible) ───────────────────────────────── */}
      <button
        onClick={() => setShowRecap(s => !s)}
        className="w-full flex items-center justify-between rounded-2xl border border-border/50 bg-muted/30 px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
      >
        <span>Resumen del mes</span>
        <CollapsibleChevron open={showRecap} />
      </button>
      <CollapsibleContent open={showRecap}>
        <MonthlyRecapCard />
      </CollapsibleContent>

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
          icon={Search}
          label="Buscar"
          onClick={() => setCommandOpen(true)}
        />
      </div>

      {/* ── Pinned items bar (Feature J) ──────────────────────────────── */}
      <PinnedItemsBar />

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

      {/* ── 📅 Recuerdos y logros (collapsible) ─────────────────────────── */}
      <button
        onClick={() => setShowMemories(s => !s)}
        className="w-full flex items-center justify-between rounded-2xl border border-border/50 bg-muted/30 px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
      >
        <span>Recuerdos y logros</span>
        <CollapsibleChevron open={showMemories} />
      </button>
      <CollapsibleContent open={showMemories} className="space-y-3">
        <MemoriesWidget />
        <HighlightsWidget />
        <AnniversaryWidget />
        <p className="text-xs text-muted-foreground text-center py-2">
          Los recuerdos aparecen cuando llevas más tiempo usando la app
        </p>
      </CollapsibleContent>

      {/* ── Activity feed ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <SectionLabel>Actividad reciente</SectionLabel>
        <ActivityFeed />
      </div>

      {/* ── Analytics toggle ──────────────────────────────────────────── */}
      <button
        onClick={() => setShowAnalytics(s => !s)}
        className="w-full flex items-center justify-between rounded-2xl border border-border/50 bg-muted/30 px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4" />
          {showAnalytics ? "Ocultar análisis" : "Ver análisis completo"}
        </div>
        <CollapsibleChevron open={showAnalytics} />
      </button>

      <CollapsibleContent open={showAnalytics} className="space-y-2">
        <SectionLabel>Análisis detallado</SectionLabel>
        <DashboardStats />
      </CollapsibleContent>

      </>)} {/* END dashMode normal */}

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
        "h-2 w-2 rounded-full",
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
