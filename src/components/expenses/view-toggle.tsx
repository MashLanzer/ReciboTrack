"use client"

import { useRouter, usePathname } from "next/navigation"
import { LayoutList, CalendarDays, GitBranch, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"

export type ViewMode = "list" | "cal" | "threads" | "grid"

interface ViewToggleProps {
  current: ViewMode
}

const VIEWS: { id: ViewMode; icon: React.ReactNode; label: string; param: string | null }[] = [
  { id: "list",    icon: <LayoutList className="h-3.5 w-3.5" />,    label: "Lista",       param: null },
  { id: "grid",    icon: <LayoutGrid className="h-3.5 w-3.5" />,    label: "Cuadrícula",  param: "grid" },
  { id: "cal",     icon: <CalendarDays className="h-3.5 w-3.5" />,  label: "Calendario",  param: "cal" },
  { id: "threads", icon: <GitBranch className="h-3.5 w-3.5" />,     label: "Hilos",       param: "threads" },
]

export function ViewToggle({ current }: ViewToggleProps) {
  const router = useRouter()
  const pathname = usePathname()

  function setView(v: ViewMode) {
    if (v === current) return
    const param = VIEWS.find((view) => view.id === v)?.param
    if (!param) {
      router.push(pathname)
    } else {
      router.push(`${pathname}?view=${param}`)
    }
  }

  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg border bg-muted/50 shrink-0 h-9">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          onClick={() => setView(v.id)}
          title={`Vista ${v.label.toLowerCase()}`}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
            current === v.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {v.icon}
          <span className="hidden sm:inline">{v.label}</span>
        </button>
      ))}
    </div>
  )
}
