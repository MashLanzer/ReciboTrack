"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { getFirebaseAuth } from "@/lib/firebase/client"
import { useAuth } from "@/hooks/use-auth"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { NAV_ITEMS, MORE_ITEMS } from "./nav-items"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  MoreHorizontal,
  Sun,
  Moon,
  LogOut,
  X,
  Search,
  Users,
} from "lucide-react"
import { AccountSwitcher } from "@/components/shared/account-switcher"
import { useUIStore } from "@/stores/ui-store"
import { toast } from "sonner"
import { QuickSplit } from "@/components/expenses/quick-split"

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const { setCommandOpen } = useUIStore()
  const [moreOpen, setMoreOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)

  // Close panel on navigation
  useEffect(() => { setMoreOpen(false) }, [pathname])

  // Close on outside tap (backdrop)
  const moreActive = MORE_ITEMS.some(
    ({ href }) => pathname === href || pathname.startsWith(href + "/")
  )

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? "?"

  async function handleSignOut() {
    try {
      await signOut(getFirebaseAuth())
      document.cookie = "session=; path=/; Max-Age=0; SameSite=Lax"
      window.location.href = "/login"
    } catch {
      toast.error("Error al cerrar sesión")
    }
  }

  return (
    <>
      <QuickSplit
        open={splitOpen}
        onClose={() => setSplitOpen(false)}
        defaultUserName={user?.displayName?.split(" ")[0] ?? "Yo"}
      />

      {/* ── Backdrop overlay when "Más" is open ─────────────────────────── */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* ── "Más" slide-up panel ─────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed left-0 right-0 z-40 md:hidden transition-all duration-300 ease-out",
          moreOpen
            ? "bottom-16 opacity-100 translate-y-0"
            : "bottom-16 opacity-0 translate-y-4 pointer-events-none"
        )}
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

          {/* Grouped nav items */}
          <div className="p-2 grid grid-cols-3 gap-1.5">
            {MORE_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/")
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                  <span className="text-[11px] font-medium">{label}</span>
                </Link>
              )
            })}
          </div>

          {/* Divider */}
          <div className="h-px bg-border mx-2" />

          {/* Profile row — full width */}
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
                <p className="text-[10px] text-muted-foreground truncate leading-tight">{user?.email}</p>
              </div>
            </Link>
          </div>

          {/* Account switcher row — full width */}
          <div className="px-2 pb-1">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40">
              <span className="text-[10px] font-medium text-muted-foreground shrink-0">Cuenta</span>
              <div className="flex-1 flex justify-center">
                <AccountSwitcher />
              </div>
            </div>
          </div>

          {/* Utility actions row — 4 equal columns */}
          <div className="px-2 pb-2 grid grid-cols-4 gap-1.5">
            <button
              onClick={() => { setMoreOpen(false); setCommandOpen(true) }}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Search className="h-4.5 w-4.5" />
              <span className="text-[10px] font-medium">Buscar</span>
            </button>

            <button
              onClick={() => { setMoreOpen(false); setSplitOpen(true) }}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Users className="h-[18px] w-[18px]" />
              <span className="text-[10px] font-medium">Dividir</span>
            </button>

            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Sun className="h-[18px] w-[18px] dark:hidden" />
              <Moon className="h-[18px] w-[18px] hidden dark:block" />
              <span className="text-[10px] font-medium">Tema</span>
            </button>

            <button
              onClick={handleSignOut}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-[18px] w-[18px]" />
              <span className="text-[10px] font-medium">Salir</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom tab bar ───────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm md:hidden">
        <div className="flex h-16 items-center justify-around px-1">
          {/* Main nav items */}
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/")
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-[56px]",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            )
          })}

          {/* "Más" toggle button */}
          <button
            onClick={() => setMoreOpen((o) => !o)}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-[56px] relative",
              moreOpen || moreActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {/* Show active dot when a "more" route is active */}
            {moreActive && !moreOpen && (
              <span className="absolute top-1.5 right-4 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
            <MoreHorizontal className={cn("h-5 w-5", (moreOpen || moreActive) && "stroke-[2.5]")} />
            <span className="text-[10px] font-medium">Más</span>
          </button>
        </div>
      </nav>
    </>
  )
}
