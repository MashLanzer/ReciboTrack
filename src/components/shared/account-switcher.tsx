"use client"

import { useUIStore, type ActiveAccount } from "@/stores/ui-store"
import { cn } from "@/lib/utils"
import { Briefcase, User } from "lucide-react"

export function AccountSwitcher() {
  const { activeAccount, setActiveAccount } = useUIStore()

  return (
    <div className="flex items-center rounded-full border bg-muted/40 p-0.5 gap-0.5 h-8">
      <button
        onClick={() => setActiveAccount("personal")}
        className={cn(
          "flex items-center gap-1 px-2.5 h-7 rounded-full text-xs font-medium transition-all",
          activeAccount === "personal"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <User className="h-3 w-3" />
        Personal
      </button>
      <button
        onClick={() => setActiveAccount("business")}
        className={cn(
          "flex items-center gap-1 px-2.5 h-7 rounded-full text-xs font-medium transition-all",
          activeAccount === "business"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Briefcase className="h-3 w-3" />
        Negocio
      </button>
    </div>
  )
}

/** Small inline badge shown next to expense totals to indicate active context */
export function AccountBadge() {
  const { activeAccount } = useUIStore()
  if (activeAccount === "personal") return null
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
      <Briefcase className="h-2.5 w-2.5" />
      Negocio
    </span>
  )
}
