"use client"

import { useHealthScore } from "@/hooks/use-health-score"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

function gradeColor(grade: string): string {
  switch (grade) {
    case "A": return "text-income"
    case "B": return "text-primary"
    case "C": return "text-warning"
    default:  return "text-destructive"
  }
}

export function HealthScoreWidget() {
  const { data, isLoading } = useHealthScore()

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-card p-4 space-y-4">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { score, grade, pillars } = data
  const conicDeg = Math.round(score * 3.6)

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-4">
      <h2 className="text-sm font-semibold">Salud Financiera</h2>

      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <div
            className="h-20 w-20 rounded-full flex items-center justify-center"
            style={{
              background: `conic-gradient(from 0deg, var(--color-primary) ${conicDeg}deg, var(--color-muted) 0deg)`,
            }}
          >
            <div className="h-[68px] w-[68px] rounded-full bg-card flex flex-col items-center justify-center">
              <span className="text-xl font-black tabular-nums leading-none">{score}</span>
              <span className={cn("text-sm font-bold leading-none mt-0.5", gradeColor(grade))}>
                {grade}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-2.5 min-w-0">
          {pillars.map((pillar) => {
            const pct = (pillar.score / pillar.max) * 100
            return (
              <div key={pillar.name} className="space-y-0.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium truncate">{pillar.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                    {pillar.score}/{pillar.max}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-primary/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-1.5 border-t pt-3">
        {pillars.map((pillar) => (
          <p key={pillar.name} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{pillar.name}:</span>{" "}
            {pillar.detail}
          </p>
        ))}
      </div>
    </div>
  )
}
