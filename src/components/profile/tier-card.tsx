"use client"

import { useMemo } from "react"
import { computeTier } from "@/lib/compute-tier"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { Zap, Star } from "lucide-react"

const TIER_GRADIENT: Record<string, string> = {
  bronce:   "from-amber-500/20 via-orange-500/8 to-transparent",
  plata:    "from-slate-400/20 via-slate-400/8 to-transparent",
  oro:      "from-yellow-400/25 via-yellow-400/8 to-transparent",
  diamante: "from-cyan-400/25 via-blue-500/8 to-transparent",
}

const TIER_RING: Record<string, string> = {
  bronce:   "#b45309",
  plata:    "#64748b",
  oro:      "#ca8a04",
  diamante: "#06b6d4",
}

interface TierCardProps {
  totalExpenses: number
}

export function TierCard({ totalExpenses }: TierCardProps) {
  const tierInfo = useMemo(() => computeTier(totalExpenses), [totalExpenses])

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Tier header — gradient per tier */}
      <div className={cn(
        "px-4 py-4 flex items-center justify-between gap-3 bg-gradient-to-r",
        TIER_GRADIENT[tierInfo.tier] ?? "from-muted/30"
      )}>
        <div className="flex items-center gap-3">
          <span className="text-3xl leading-none">{tierInfo.emoji}</span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tu nivel</p>
            <p className={cn("text-lg font-black capitalize leading-tight", tierInfo.color)}>
              {tierInfo.label}
            </p>
          </div>
        </div>
        <Zap className="h-5 w-5 shrink-0" style={{ color: TIER_RING[tierInfo.tier] ?? "currentColor", opacity: 0.5 }} />
      </div>

      <div className="p-4 space-y-4">
        {/* Progress to next tier */}
        {tierInfo.nextTier !== null && tierInfo.nextAt !== null && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Progreso a <span className="font-semibold text-foreground capitalize">{tierInfo.nextTier}</span>
              </span>
              <span className="tabular-nums font-medium text-muted-foreground">
                {totalExpenses}/{tierInfo.nextAt}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${tierInfo.progress}%`, backgroundColor: TIER_RING[tierInfo.tier] }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-right">
              {tierInfo.nextAt - totalExpenses} gastos para el siguiente nivel
            </p>
          </div>
        )}

        {tierInfo.nextTier === null && (
          <div className="flex items-center justify-center gap-2 py-1 text-cyan-600 dark:text-cyan-400">
            <Star className="h-3.5 w-3.5 fill-current" />
            <p className="text-xs font-semibold">¡Nivel máximo alcanzado!</p>
            <Star className="h-3.5 w-3.5 fill-current" />
          </div>
        )}

        {/* Benefits */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Beneficios de {tierInfo.label}
          </p>
          <ul className="space-y-1">
            {tierInfo.benefits.map((b) => (
              <li key={b} className="flex items-center gap-2 text-xs">
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: TIER_RING[tierInfo.tier] }}
                />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
