"use client"

import { useRouter, usePathname } from "next/navigation"
import { LayoutList, CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"

interface ViewToggleProps {
  current: "list" | "cal"
}

export function ViewToggle({ current }: ViewToggleProps) {
  const router = useRouter()
  const pathname = usePathname()

  function setView(v: "list" | "cal") {
    if (v === current) return
    if (v === "list") {
      router.push(pathname)
    } else {
      router.push(`${pathname}?view=cal`)
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
    </div>
  )
}
