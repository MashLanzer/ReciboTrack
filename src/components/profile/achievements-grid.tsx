"use client"

import { useMemo } from "react"
import { computeAchievements, type AchievementInput } from "@/lib/compute-achievements"
import { cn } from "@/lib/utils"
import { Trophy } from "lucide-react"

interface AchievementsGridProps {
  input: AchievementInput
}

export function AchievementsGrid({ input }: AchievementsGridProps) {
  const achievements = useMemo(() => computeAchievements(input), [input])
  const unlocked = achievements.filter((a) => a.unlocked)
  const locked = achievements.filter((a) => !a.unlocked)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-semibold">Logros</p>
        <span className="text-xs text-muted-foreground">
          {unlocked.length}/{achievements.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${achievements.length > 0 ? (unlocked.length / achievements.length) * 100 : 0}%` }}
        />
      </div>

      {/* Unlocked */}
      {unlocked.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {unlocked.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2.5 rounded-xl border bg-card p-3"
            >
              <span className="text-2xl leading-none shrink-0">{a.emoji}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{a.title}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{a.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Por desbloquear
          </p>
          <div className="grid grid-cols-2 gap-2">
            {locked.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2.5 rounded-xl border border-dashed bg-muted/20 p-3 opacity-50"
              >
                <span className="text-2xl leading-none shrink-0 grayscale">{a.emoji}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{a.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
