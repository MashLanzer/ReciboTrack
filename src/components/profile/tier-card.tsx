"use client"

import { useMemo } from "react"
import { computeTier } from "@/lib/compute-tier"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { Zap } from "lucide-react"

interface TierCardProps {
  totalExpenses: number
}

export function TierCard({ totalExpenses }: TierCardProps) {
  const tierInfo = useMemo(() => computeTier(totalExpenses), [totalExpenses])

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Tier header */}
      <div className="px-4 py-3 bg-muted/30 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Tu nivel</p>
        </div>
        <span className={cn("font-bold text-sm", tierInfo.color)}>
          {tierInfo.emoji} {tierInfo.label}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Progress to next tier */}
        {tierInfo.nextTier !== null && tierInfo.nextAt !== null && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Progreso a <span className="font-medium text-foreground capitalize">{tierInfo.nextTier}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {totalExpenses}/{tierInfo.nextAt} gastos
              </span>
            </div>
            <Progress value={tierInfo.progress} className="h-2" />
            <p className="text-[10px] text-muted-foreground text-right">
              {tierInfo.nextAt - totalExpenses} gastos para el siguiente nivel
            </p>
          </div>
        )}

        {tierInfo.nextTier === null && (
          <div className="text-center py-1">
            <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
              ¡Nivel máximo alcanzado!
            </p>
          </div>
        )}

        {/* Benefits */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Beneficios de {tierInfo.label}
          </p>
          <ul className="space-y-1">
            {tierInfo.benefits.map((b) => (
              <li key={b} className="flex items-center gap-2 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
