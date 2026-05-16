"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { signOut } from "firebase/auth"
import { getFirebaseAuth } from "@/lib/firebase/client"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { NAV_ITEMS, MORE_ITEMS } from "./nav-items"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { LogOut, Moon, Sun, UserCircle, ChevronDown, Search } from "lucide-react"
import { AccountSwitcher } from "@/components/shared/account-switcher"
import { useTheme } from "next-themes"
import { useUIStore } from "@/stores/ui-store"
import { toast } from "sonner"

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const { setCommandOpen } = useUIStore()

  async function handleSignOut() {
    try {
      await signOut(getFirebaseAuth())
      document.cookie = "session=; path=/; Max-Age=0; SameSite=Lax"
      window.location.href = "/login"
    } catch {
      toast.error("Error al cerrar sesión")
    }
  }

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? "?"

  // Is any "more" item currently active?
  const moreActive = MORE_ITEMS.some(
    ({ href }) => pathname === href || pathname.startsWith(href + "/")
  )

  return (
    <header className="hidden md:flex sticky top-0 z-40 h-14 items-center border-b bg-background/95 backdrop-blur-sm px-6 gap-6">
      <Link href="/dashboard" className="font-serif text-lg font-semibold tracking-tight mr-4">
        ReciboTrack
      </Link>

      <nav className="flex items-center gap-1">
        {/* Main nav items */}
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}

        {/* "Más" dropdown — Recurrentes, Presupuestos, Categorías */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                moreActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              Más
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {MORE_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/")
              return (
                <DropdownMenuItem key={href} asChild>
                  <Link
                    href={href}
                    className={cn("flex items-center gap-2 w-full", active && "font-semibold text-foreground")}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {/* Account switcher */}
        <AccountSwitcher />

        {/* Command palette trigger */}
        <button
          onClick={() => setCommandOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm"
          aria-label="Búsqueda global"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden lg:inline text-xs">Buscar...</span>
          <kbd className="hidden lg:inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded border bg-background text-[10px] font-mono text-muted-foreground">
            ⌘K
          </kbd>
        </button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Cambiar tema"
        >
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="h-4 w-4 hidden dark:block" />
        </Button>

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 w-9 rounded-full p-0">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.photoURL ?? ""} alt={user?.displayName ?? ""} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal pb-1">
              <p className="text-sm font-medium truncate">{user?.displayName ?? "Usuario"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/profile")}>
              <UserCircle className="h-4 w-4" />
              Perfil y ajustes
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
