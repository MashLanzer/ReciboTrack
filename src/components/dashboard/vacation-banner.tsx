"use client"

import { X } from "lucide-react"
import { useUIStore } from "@/stores/ui-store"

export function VacationBanner() {
  const { vacationMode, setVacationMode } = useUIStore()
  const { active, endsAt } = vacationMode

  if (!active || endsAt === null || endsAt <= Date.now()) return null

  const msRemaining = endsAt - Date.now()
  const daysRemaining = Math.ceil(msRemaining / 86400000)

  return (
    <div className="bg-info/10 border border-info/30 rounded-2xl px-4 py-3 flex items-center gap-3">
      <span className="text-xl shrink-0" aria-hidden="true">🏖️</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Modo vacaciones activo</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {daysRemaining === 1 ? "1 día restante" : `${daysRemaining} días restantes`}
        </p>
      </div>
      <button
        onClick={() => setVacationMode(null)}
        aria-label="Desactivar modo vacaciones"
        className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
