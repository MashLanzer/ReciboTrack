"use client"

import { useState } from "react"
import { ScanLine, Plus, Search, TrendingUp, RefreshCw, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useUIPrefs } from "@/hooks/use-ui-prefs"

type ActionKey = "scan" | "add" | "search" | "income" | "recurring" | "budgets"

const ALL_ACTIONS: { key: ActionKey; label: string; icon: React.ElementType }[] = [
  { key: "scan",      label: "Escanear",      icon: ScanLine    },
  { key: "add",       label: "Añadir",        icon: Plus        },
  { key: "search",    label: "Buscar",        icon: Search      },
  { key: "income",    label: "Ingresos",      icon: TrendingUp  },
  { key: "recurring", label: "Recurrentes",   icon: RefreshCw   },
  { key: "budgets",   label: "Presupuestos",  icon: Wallet      },
]

const MAX_SELECTED = 3

interface QuickActionsSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickActionsSettingsDialog({ open, onOpenChange }: QuickActionsSettingsDialogProps) {
  const { prefs, setPref } = useUIPrefs()
  const [selected, setSelected] = useState<string[]>(prefs.quickActions ?? ["scan", "add", "search"])

  function toggle(key: string) {
    if (selected.includes(key)) {
      setSelected(selected.filter((k) => k !== key))
    } else if (selected.length < MAX_SELECTED) {
      setSelected([...selected, key])
    }
  }

  function handleSave() {
    setPref("quickActions", selected)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Atajos rápidos</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Elige exactamente 3 acciones para mostrar en el panel principal.
        </p>

        <div className="grid grid-cols-3 gap-2">
          {ALL_ACTIONS.map(({ key, label, icon: Icon }) => {
            const isSelected = selected.includes(key)
            const isDisabled = !isSelected && selected.length >= MAX_SELECTED
            return (
              <button
                key={key}
                onClick={() => toggle(key)}
                disabled={isDisabled}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 rounded-2xl border py-3.5 text-xs font-semibold transition-all",
                  isSelected
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : isDisabled
                      ? "border-border/50 bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                      : "border-border bg-card text-foreground hover:bg-accent/60"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            )
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {selected.length}/{MAX_SELECTED} seleccionados
        </p>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={selected.length !== MAX_SELECTED}
            onClick={handleSave}
          >
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
