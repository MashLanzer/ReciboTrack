"use client"

import { useAchievements } from "@/hooks/use-achievements"
import { Skeleton } from "@/components/ui/skeleton"
import { Lock } from "lucide-react"

export function AchievementsWidget() {
  const { data, isLoading } = useAchievements()

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-12 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const streak = data?.streak ?? { current: 0, longest: 0 }
  const all = data?.all ?? []
  const earnedCount = all.filter((a) => a.earned).length

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Logros</h2>
        {streak.current > 0 && (
          <span className="text-xs font-bold text-primary flex items-center gap-1">
            🔥 Racha: {streak.current} {streak.current === 1 ? "día" : "días"}
          </span>
        )}
      </div>

      {earnedCount === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          ¡Empieza a registrar gastos para desbloquear logros!
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {all.map((achievement) => (
            <div
              key={achievement.id}
              title={achievement.earned ? achievement.description : `Bloqueado: ${achievement.description}`}
              className={`shrink-0 flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-xl border transition-all ${
                achievement.earned
                  ? "bg-primary/5 border-primary/20"
                  : "bg-muted/30 border-border/40 opacity-40"
              }`}
            >
              {achievement.earned ? (
                <span className="text-xl leading-none">{achievement.emoji}</span>
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-[9px] font-medium text-center leading-tight px-0.5 line-clamp-2">
                {achievement.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {earnedCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {earnedCount} de {all.length} logros desbloqueados
        </p>
      )}
    </div>
  )
}
