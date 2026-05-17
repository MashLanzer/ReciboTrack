"use client"

import { useRouter, usePathname } from "next/navigation"
import { LayoutList, CalendarDays, GitBranch } from "lucide-react"
import { cn } from "@/lib/utils"

export type ViewMode = "list" | "cal" | "threads"

interface ViewToggleProps {
  current: ViewMode
}

export function ViewToggle({ current }: ViewToggleProps) {
  const router = useRouter()
  const pathname = usePathname()

  function setView(v: ViewMode) {
    if (v === current) return
    if (v === "list") {
      router.push(pathname)
    } else if (v === "cal") {
      router.push(`${pathname}?view=cal`)
    } else {
      router.push(`${pathname}?view=threads`)
    }
  }

  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg border bg-muted/50 shrink-0 h-9">
      <button
        onClick={() => setView("list")}
        title="Vista lista"
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
          current === "list"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <LayoutList className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Lista</span>
      </button>
      <button
        onClick={() => setView("cal")}
        title="Vista calendario"
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
          current === "cal"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <CalendarDays className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Calendario</span>
      </button>
      <button
        onClick={() => setView("threads")}
        title="Vista hilos"
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
          current === "threads"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <GitBranch className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Hilos</span>
      </button>
    </div>
  )
}
