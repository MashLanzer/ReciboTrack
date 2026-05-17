"use client"

import { useUIStore } from "@/stores/ui-store"
import { useRoundupSettings } from "@/hooks/use-roundup-settings"
import { useGoals } from "@/hooks/use-goals"
import { RoundUpPrompt } from "./round-up-prompt"

export function RoundUpWatcher() {
  const { roundupExpense, setRoundupExpense } = useUIStore()
  const { data: roundupSettings } = useRoundupSettings()
  const { data: goals = [] } = useGoals()

  if (!roundupExpense) return null
  if (!roundupSettings?.roundupEnabled) return null
  if (!roundupSettings.roundupGoalId) return null

  const goal = goals.find(g => g.id === roundupSettings.roundupGoalId && g.isActive)
  if (!goal) return null

  // If already whole number, don't show
  const diff = Math.ceil(roundupExpense.total) - roundupExpense.total
  if (diff === 0) return null

  return (
    <RoundUpPrompt
      expense={roundupExpense}
      goalId={goal.id}
      goalName={goal.name}
      goalCurrentAmount={goal.currentAmount}
      onDismiss={() => setRoundupExpense(null)}
    />
  )
}
