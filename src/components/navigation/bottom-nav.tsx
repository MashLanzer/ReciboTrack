"use client"

import { useState, useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "firebase/auth"
import { getFirebaseAuth } from "@/lib/firebase/client"
import { useAuth } from "@/hooks/use-auth"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { NAV_ITEMS, MORE_ITEMS, MORE_GROUPS } from "./nav-items"
import { useNavAlerts } from "@/hooks/use-nav-alerts"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  MoreHorizontal,
  Sun,
  Moon,
  LogOut,
  X,
  Search,
  Users,
  ScanLine,
  PenLine,
  TrendingUp,
  Plus,
  Zap,
  ArrowLeftRight,
} from "lucide-react"
import { AccountSwitcher } from "@/components/shared/account-switcher"
import { useUIStore } from "@/stores/ui-store"
import { toast } from "sonner"
import { QuickSplit } from "@/components/expenses/quick-split"
import { useQuickExpenses, useDeleteQuickExpense } from "@/hooks/use-quick-expenses"
import { useAddExpense } from "@/hooks/use-expenses"
import { formatCurrency } from "@/lib/utils"
import type { QuickExpense } from "@/types"

export function BottomNav() {
  const pathname = usePathname()
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const { setCommandOpen, setScannerOpen, setQuickAddOpen, setIncomeAddOpen } = useUIStore()
  const queryClient = useQueryClient()
  const [moreOpen, setMoreOpen] = useState(false)
  const [actionOpen, setActionOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const { overdueCount, exceededCount } = useNavAlerts()
  const totalAlerts = overdueCount + exceededCount

  // ── Animation tracking: detect which tab just became active ───────────────
  const [animatingHref, setAnimatingHref] = useState<string | null>(null)
  const prevPathnameRef = useRef<string>(pathname)

  useEffect(() => {
    if (prevPathnameRef.current === pathname) return
    prevPathnameRef.current = pathname

    // Find which primary nav item just became active
    const nowActive = NAV_ITEMS.find(
      ({ href }) => pathname === href || pathname.startsWith(href + "/")
    )
    if (nowActive) {
      setAnimatingHref(nowActive.href)
      const t = setTimeout(() => setAnimatingHref(null), 450)
      return () => clearTimeout(t)
    }
  }, [pathname])

  const { data: quickExpenses = [] } = useQuickExpenses()
  const deleteQuick = useDeleteQuickExpense()
  const addExpense = useAddExpense()

  async function handleQuickTap(q: QuickExpense) {
    if (loadingId) return
    setLoadingId(q.id)
    try {
      await addExpense.mutateAsync({
        merchant: q.merchant,
        date: new Date(),
        items: [],
        subtotal: q.amount,
        tax: 0,
        total: q.amount,
        paymentMethod: q.paymentMethod,
        reference: null,
        category: q.category,
        currency: q.currency,
        notes: "",
        tags: q.tags,
        receiptImageUrl: null,
      })
      toast.success(`${q.icon} ${q.label} añadido`, {
        description: formatCurrency(q.amount, q.currency),
      })
    } catch {
      toast.error("Error al añadir el gasto")
    } finally {
      setLoadingId(null)
    }
  }

  // Close panels on navigation
  useEffect(() => {
    setMoreOpen(false)
    setActionOpen(false)
  }, [pathname])

  const moreActive = MORE_ITEMS.some(
    ({ href }) => pathname === href || pathname.startsWith(href + "/")
  )

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? "?"

  async function handleSignOut() {
    try {
      await signOut(getFirebaseAuth())
      // #8 — Limpiar caché de React Query para que el siguiente usuario
      // no vea datos del usuario anterior al volver a loguearse
      queryClient.clear()
      document.cookie = "session=; path=/; Max-Age=0; SameSite=Lax"
      window.location.href = "/login"
    } catch {
      toast.error("Error al cerrar sesión")
    }
  }

  function openScanner() {
    setActionOpen(false)
    setScannerOpen(true)
  }

  function openQuickAdd() {
    setActionOpen(false)
    setQuickAddOpen(true)
  }

  function openIncome() {
    setActionOpen(false)
    setIncomeAddOpen(true)
  }

  return (
    <>
      <QuickSplit
        open={splitOpen}
        onClose={() => setSplitOpen(false)}
        defaultUserName={user?.displayName?.split(" ")[0] ?? "Yo"}
      />

      {/* ── Combined backdrop (action + more panels) ─────────────────────── */}
      {(moreOpen || actionOpen) && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => { setMoreOpen(false); setActionOpen(false) }}
        />
      )}

      {/* ── Action sheet (scanner / gasto / ingreso) ─────────────────────── */}
      <div
        className={cn(
          "fixed left-0 right-0 z-40 md:hidden transition-all duration-200 ease-out",
          actionOpen
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-3 pointer-events-none"
        )}
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-3 mb-2 rounded-2xl border bg-background/98 backdrop-blur-md shadow-xl overflow-hidden">
          <div className="p-2 grid grid-cols-3 gap-1.5">
            <ActionBtn
              icon={<ScanLine className="h-5 w-5" />}
              label="Escanear recibo"
              onClick={openScanner}
            />
            <ActionBtn
              icon={<PenLine className="h-5 w-5" />}
              label="Gasto manual"
              onClick={openQuickAdd}
            />
            <ActionBtn
              icon={<TrendingUp className="h-5 w-5" />}
              label="Añadir ingreso"
              onClick={openIncome}
            />
          </div>
        </div>
      </div>

      {/* ── "Más" slide-up panel ─────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed left-0 right-0 z-40 md:hidden transition-all duration-300 ease-out",
          moreOpen
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        )}
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-3 mb-2 rounded-2xl border bg-background/98 backdrop-blur-md shadow-xl overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Más opciones</span>
            <button
              onClick={() => setMoreOpen(false)}
              className="h-6 w-6 rounded-full bg-muted flex items-center justify-center"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Accesos rápidos */}
          {quickExpenses.length > 0 && (
            <>
              <div className="px-4 pt-2 pb-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Accesos rápidos
                </p>
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                  {quickExpenses.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => { setMoreOpen(false); handleQuickTap(q) }}
                      disabled={!!loadingId}
                      className={cn(
                        "shrink-0 flex flex-col items-center gap-1 w-16 py-2 rounded-xl border bg-card",
                        "hover:border-primary/50 hover:bg-primary/5 active:scale-95 transition-all",
                        loadingId === q.id && "opacity-60"
                      )}
                    >
                      <span className="text-xl leading-none">{q.icon}</span>
                      <span className="text-[10px] font-medium truncate w-full text-center px-1 leading-tight">{q.label}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{formatCurrency(q.amount, q.currency)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-px bg-border mx-2" />
            </>
          )}

          {/* Grouped nav items */}
          <div className="px-2 pt-1 space-y-2 pb-1">
            {MORE_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1 mb-1">
                  {group.label}
                </p>
                <div className="grid grid-cols-5 gap-1">
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href || pathname.startsWith(href + "/")
                    // Per-item alert count
                    const alertCount =
                      href === "/recurring" ? overdueCount :
                      href === "/budgets"   ? exceededCount : 0
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          "relative flex flex-col items-center gap-1 px-1 py-2.5 rounded-xl transition-colors",
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        )}
                      >
                        {alertCount > 0 && (
                          <span className="absolute top-1 right-1 h-3.5 min-w-[0.875rem] px-0.5 rounded-full
                            bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center">
                            {alertCount}
                          </span>
                        )}
                        <Icon className={cn("h-[18px] w-[18px]", active && "stroke-[2.5]")} />
                        <span className="text-[10px] font-medium text-center leading-tight line-clamp-1">{label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-border mx-2" />

          {/* Profile row */}
          <div className="px-2 pt-2 pb-1">
            <Link
              href="/profile"
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 rounded-xl transition-colors",
                pathname === "/profile"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={user?.photoURL ?? ""} />
                <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate leading-tight">{user?.displayName ?? "Perfil"}</p>
                <p className="text-[11px] text-muted-foreground truncate leading-tight">{user?.email}</p>
              </div>
            </Link>
          </div>

          {/* Account switcher + Buscar */}
          <div className="px-2 pb-1">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40">
              <span className="text-[11px] font-medium text-muted-foreground shrink-0">Cuenta</span>
              <div className="flex-1 flex justify-center">
                <AccountSwitcher />
              </div>
              <button
                onClick={() => { setMoreOpen(false); setCommandOpen(true) }}
                className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                aria-label="Buscar"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Utility actions */}
          <div className="px-2 pb-2 grid grid-cols-4 gap-1.5">
            <Link
              href="/groups"
              onClick={() => setMoreOpen(false)}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors",
                pathname === "/groups" || pathname.startsWith("/groups/")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Users className="h-[18px] w-[18px]" />
              <span className="text-[11px] font-medium">Grupos</span>
            </Link>
            <button
              onClick={() => { setMoreOpen(false); setSplitOpen(true) }}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <ArrowLeftRight className="h-[18px] w-[18px]" />
              <span className="text-[11px] font-medium">Dividir</span>
            </button>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Sun className="h-[18px] w-[18px] dark:hidden" />
              <Moon className="h-[18px] w-[18px] hidden dark:block" />
              <span className="text-[11px] font-medium">Tema</span>
            </button>
            <button
              onClick={handleSignOut}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-[18px] w-[18px]" />
              <span className="text-[11px] font-medium">Salir</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── FAB — positioned completely above the nav bar ───────────────── */}
      {/* bottom = 4rem (nav h-16) + safe-area + 0.75rem gap                 */}
      {/* This guarantees the full circle is always above the tab bar.        */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-50 md:hidden"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
      >
        <button
          onClick={() => { setActionOpen((o) => !o); setMoreOpen(false) }}
          aria-label={actionOpen ? "Cerrar" : "Añadir"}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full",
            "bg-primary text-primary-foreground",
            // Glow shadow — matches primary color
            "shadow-[0_8px_28px_-4px_hsl(var(--primary)/0.55)]",
            // Smooth spring rotation only — no scale change on open/close
            "transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            // Press feedback: fast compress + shadow collapse
            "active:scale-[0.88] active:shadow-none active:transition-none",
            actionOpen ? "rotate-45" : "rotate-0"
          )}
        >
          <Plus className="h-7 w-7" />
        </button>
      </div>

      {/* ── Bottom tab bar ───────────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background/80 backdrop-blur-xl
          shadow-[0_-1px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_-1px_16px_rgba(0,0,0,0.35)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex h-16 items-center px-1">

          {/* Left half: Dashboard + Gastos */}
          <div className="flex flex-1 items-center justify-around">
            {NAV_ITEMS.slice(0, 2).map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/")
              const justActivated = animatingHref === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl min-w-[56px]",
                    "transition-[color,background-color] duration-200",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    active ? "stroke-[2.5] scale-110" : "scale-100",
                    justActivated && "nav-icon-pop"
                  )} />
                  <span className={cn(
                    "text-[11px] font-medium transition-[font-weight] duration-200",
                    active && "font-semibold",
                    justActivated && "nav-label-in"
                  )}>{label}</span>
                  {/* Active indicator dot */}
                  {active && (
                    <span className={cn(
                      "absolute bottom-0.5 h-[3px] w-4 rounded-full bg-foreground origin-center",
                      justActivated && "nav-dot-grow"
                    )} />
                  )}
                </Link>
              )
            })}
          </div>

          {/* Center placeholder — actual FAB is a separate fixed z-50 element above */}
          <div className="w-16 shrink-0" />

          {/* Right half: Análisis + Más */}
          <div className="flex flex-1 items-center justify-around">
            {NAV_ITEMS.slice(2, 3).map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/")
              const justActivated = animatingHref === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl min-w-[56px]",
                    "transition-[color,background-color] duration-200",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    active ? "stroke-[2.5] scale-110" : "scale-100",
                    justActivated && "nav-icon-pop"
                  )} />
                  <span className={cn(
                    "text-[11px] font-medium transition-[font-weight] duration-200",
                    active && "font-semibold",
                    justActivated && "nav-label-in"
                  )}>{label}</span>
                  {active && (
                    <span className={cn(
                      "absolute bottom-0.5 h-[3px] w-4 rounded-full bg-foreground origin-center",
                      justActivated && "nav-dot-grow"
                    )} />
                  )}
                </Link>
              )
            })}

            {/* "Más" toggle */}
            <button
              onClick={() => { setMoreOpen((o) => !o); setActionOpen(false) }}
              className={cn(
                "relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-[56px]",
                moreOpen || moreActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {/* Alert count badge on Más button */}
              {totalAlerts > 0 && !moreOpen && (
                <span className="absolute top-1 right-2.5 h-4 min-w-[1rem] px-0.5 rounded-full
                  bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center
                  animate-[fadeSlideUp_0.2s_ease-out_both]">
                  {totalAlerts}
                </span>
              )}
              {moreActive && !moreOpen && totalAlerts === 0 && (
                <span className="absolute top-1.5 right-4 h-1.5 w-1.5 rounded-full bg-primary" />
              )}
              <MoreHorizontal className={cn(
                "h-5 w-5 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                (moreOpen || moreActive) && "stroke-[2.5]",
                moreOpen && "rotate-90"
              )} />
              <span className="text-[11px] font-medium">Más</span>
              {/* Active dot for Más when a "more" route is active */}
              {moreActive && !moreOpen && totalAlerts === 0 && (
                <span className="absolute bottom-0.5 h-[3px] w-4 rounded-full bg-foreground origin-center" />
              )}
            </button>
          </div>
        </div>
      </nav>
    </>
  )
}

// ─── Action button sub-component ─────────────────────────────────────────────

function ActionBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 px-2 py-4 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      {icon}
      <span className="text-[11px] font-medium leading-tight text-center">{label}</span>
    </button>
  )
}
