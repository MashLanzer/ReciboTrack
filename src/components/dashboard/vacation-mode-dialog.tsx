"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useUIStore } from "@/stores/ui-store"

const DAY_OPTIONS = [3, 7, 14, 30] as const

interface VacationModeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VacationModeDialog({ open, onOpenChange }: VacationModeDialogProps) {
  const { setVacationMode } = useUIStore()
  const [selected, setSelected] = useState<number>(7)

  function handleActivate() {
    setVacationMode(selected)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span aria-hidden="true">🏖️</span>
            Modo vacaciones
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Pausa todas las alertas de presupuesto y objetivos durante tu tiempo libre.
        </p>

        <div className="grid grid-cols-4 gap-2">
          {DAY_OPTIONS.map((days) => (
            <button
              key={days}
              onClick={() => setSelected(days)}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border py-3 text-sm font-semibold transition-all",
                selected === days
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground hover:bg-accent/60"
              )}
            >
              <span className="text-lg font-black">{days}</span>
              <span className="text-xs text-muted-foreground">días</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleActivate}>
            Activar modo vacaciones
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
