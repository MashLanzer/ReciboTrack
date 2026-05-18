"use client"

import { LayoutList, CalendarDays, GitBranch, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"

export type ViewMode = "list" | "cal" | "threads" | "grid"

interface ViewToggleProps {
  current: ViewMode
  onChange: (v: ViewMode) => void
}

const VIEWS: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
  { id: "list",    icon: <LayoutList className="h-3.5 w-3.5" />,   label: "Lista" },
  { id: "grid",    icon: <LayoutGrid className="h-3.5 w-3.5" />,   label: "Cuadrícula" },
  { id: "cal",     icon: <CalendarDays className="h-3.5 w-3.5" />, label: "Calendario" },
  { id: "threads", icon: <GitBranch className="h-3.5 w-3.5" />,    label: "Hilos" },
]

export function ViewToggle({ current, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg border bg-muted/50 shrink-0 h-9">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          onClick={() => onChange(v.id)}
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
