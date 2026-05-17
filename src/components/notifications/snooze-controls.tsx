"use client"

import { useState, useEffect } from "react"
import { snoozeAlert, isAlertSnoozed, clearSnooze, getSnoozeUntil } from "@/lib/alert-snooze"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { BellOff, Bell, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface SnoozeControlsProps {
  categoryId: string
}

const SNOOZE_OPTIONS = [
  { label: "1 día", days: 1 },
  { label: "3 días", days: 3 },
  { label: "7 días", days: 7 },
  { label: "Este mes", days: 30 },
]

export function SnoozeControls({ categoryId }: SnoozeControlsProps) {
  const key = `budget:${categoryId}`
  const [snoozed, setSnoozed] = useState(false)
  const [until, setUntil] = useState<Date | null>(null)

  // Re-check on mount and after actions
  function refresh() {
    setSnoozed(isAlertSnoozed(key))
    setUntil(getSnoozeUntil(key))
  }

  useEffect(() => {
    refresh()
  }, [categoryId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSnooze(days: number) {
    snoozeAlert(key, days)
    refresh()
    toast.success(`Alertas silenciadas por ${days === 30 ? "este mes" : `${days} día${days > 1 ? "s" : ""}`}`)
  }

  function handleReactivate() {
    clearSnooze(key)
    refresh()
    toast.success("Alertas reactivadas")
  }

  if (snoozed && until) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <BellOff className="h-3 w-3" />
          Silenciado hasta {format(until, "d MMM", { locale: es })}
        </span>
        <button
          onClick={handleReactivate}
          className="text-[11px] font-semibold text-primary hover:underline"
        >
          Reactivar
        </button>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2">
          <BellOff className="h-3 w-3" />
          Silenciar
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {SNOOZE_OPTIONS.map((opt) => (
          <DropdownMenuItem key={opt.days} onClick={() => handleSnooze(opt.days)}>
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
