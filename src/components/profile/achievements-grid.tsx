"use client"

import { useMemo } from "react"
import { computeAchievements, type AchievementInput } from "@/lib/compute-achievements"
import { cn } from "@/lib/utils"
import { Trophy, Lock } from "lucide-react"

interface AchievementsGridProps {
  input: AchievementInput
}

export function AchievementsGrid({ input }: AchievementsGridProps) {
  const achievements = useMemo(() => computeAchievements(input), [input])
  const unlocked = achievements.filter((a) => a.unlocked)
  const locked = achievements.filter((a) => !a.unlocked)
  const pct = achievements.length > 0 ? (unlocked.length / achievements.length) * 100 : 0

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Trophy className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-sm font-semibold">Logros</p>
        </div>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {unlocked.length}
          <span className="text-muted-foreground/50">/{achievements.length}</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Unlocked */}
      {unlocked.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {unlocked.map((a, i) => (
            <div
              key={a.id}
              className="relative flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/8 to-amber-600/4 p-3 overflow-hidden shadow-sm animate-[fadeSlideUp_0.3s_ease-out_both]"
              style={{ animationDelay: `${i * 60}ms` } as React.CSSProperties}
            >
              {/* Subtle glow */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-400/10 via-transparent to-transparent pointer-events-none" />
              <span className="text-2xl leading-none shrink-0 relative">{a.emoji}</span>
              <div className="min-w-0 relative">
                <p className="text-xs font-bold truncate">{a.title}</p>
                <p className="text-xs text-muted-foreground leading-tight">{a.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-1">
            <div className="h-px flex-1 bg-border/50" />
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 shrink-0">
              Por desbloquear
            </p>
            <div className="h-px flex-1 bg-border/50" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {locked.map((a, i) => (
              <div
                key={a.id}
                className="relative flex items-center gap-2.5 rounded-xl border border-dashed border-border/60 bg-muted/10 p-3 overflow-hidden animate-[fadeSlideUp_0.3s_ease-out_both]"
                style={{ animationDelay: `${(unlocked.length + i) * 40}ms` } as React.CSSProperties}
              >
                <span className="text-2xl leading-none shrink-0 grayscale opacity-30">{a.emoji}</span>
                <div className="min-w-0 blur-[2px] opacity-50">
                  <p className="text-xs font-semibold truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground leading-tight">{a.description}</p>
                </div>
                {/* Lock overlay */}
                <div className="absolute inset-0 flex items-center justify-end pr-2.5 pointer-events-none">
                  <Lock className="h-3 w-3 text-muted-foreground/30" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {unlocked.length === 0 && (
        <div className="rounded-xl border border-dashed bg-muted/10 p-6 text-center space-y-1">
          <p className="text-2xl">🏆</p>
          <p className="text-xs font-semibold text-muted-foreground">Completa tus primeros gastos</p>
          <p className="text-xs text-muted-foreground/60">Los logros aparecerán aquí</p>
        </div>
      )}
    </div>
  )
}
