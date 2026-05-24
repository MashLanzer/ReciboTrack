"use client"

import { useState } from "react"
import { useGroupReactions, useToggleReaction } from "@/hooks/use-group-reactions"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

const EMOJI_OPTIONS = ["👍", "✅", "❓", "🔥", "💡", "😬"] as const

interface Props {
  groupId: string
  expenseId: string
}

export function ExpenseReactions({ groupId, expenseId }: Props) {
  const { user } = useAuth()
  const reactions = useGroupReactions(groupId, expenseId)
  const toggle = useToggleReaction()
  const [pickerOpen, setPickerOpen] = useState(false)

  const currentUserEmoji = (() => {
    for (const [emoji, entries] of reactions.entries()) {
      if (entries.some((e) => e.userId === user?.uid)) return emoji
    }
    return null
  })()

  const sorted = [...reactions.entries()].sort((a, b) => b[1].length - a[1].length)

  async function handleToggle(emoji: string) {
    if (!user) return
    await toggle.mutateAsync({ groupId, expenseId, emoji })
    setPickerOpen(false)
  }

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {/* Existing reaction pills */}
      {sorted.map(([emoji, entries]) => (
        <button
          key={emoji}
          onClick={() => handleToggle(emoji)}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
            currentUserEmoji === emoji
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border bg-muted/40 text-muted-foreground hover:border-muted-foreground"
          )}
        >
          <span>{emoji}</span>
          <span className="tabular-nums">{entries.length}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <div className="relative">
        <button
          onClick={() => setPickerOpen((o) => !o)}
          className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-dashed border-border text-[10px] text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
          aria-label="Añadir reacción"
        >
          +
        </button>

        {pickerOpen && (
          <div className="absolute bottom-full left-0 mb-1 z-20 flex gap-1 rounded-xl border bg-card p-1.5 shadow-lg">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleToggle(emoji)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-base hover:bg-accent transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
