"use client"

import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  isStarred: boolean
  onToggle: () => void
  size?: "sm" | "md"
  className?: string
}

export function StarButton({ isStarred, onToggle, size = "sm", className }: Props) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"
  const btnSize = size === "sm" ? "h-6 w-6" : "h-7 w-7"

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        onToggle()
      }}
      className={cn(
        "flex items-center justify-center rounded-lg transition-all",
        btnSize,
        isStarred
          ? "text-amber-500"
          : "text-muted-foreground hover:text-amber-500",
        className
      )}
      aria-label={isStarred ? "Quitar de favoritos" : "Añadir a favoritos"}
    >
      <Star
        className={cn(iconSize, isStarred ? "fill-amber-500" : "fill-none")}
      />
    </button>
  )
}
