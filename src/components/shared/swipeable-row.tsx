"use client"

import { useRef, useState, useCallback } from "react"
import { Edit, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SwipeableRowProps {
  children: React.ReactNode
  onEdit?: () => void
  onDelete?: () => void
  /** Disable swipe gestures (e.g. when in bulk-select mode) */
  disabled?: boolean
  /** Píxeles mínimos para activar el swipe */
  threshold?: number
}

export function SwipeableRow({ children, onEdit, onDelete, disabled = false, threshold = 60 }: SwipeableRowProps) {
  const startXRef = useRef<number | null>(null)
  const [offset, setOffset] = useState(0)
  const [revealed, setRevealed] = useState<"left" | "right" | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const SNAP = 80 // px that the row snaps to when revealing actions

  const reset = useCallback(() => {
    setOffset(0)
    setRevealed(null)
  }, [])

  function onTouchStart(e: React.TouchEvent) {
    if (disabled) return
    startXRef.current = e.touches[0].clientX
  }

  function onTouchMove(e: React.TouchEvent) {
    if (disabled || startXRef.current === null) return
    const dx = e.touches[0].clientX - startXRef.current

    // Only allow swipe left (negative dx) to reveal right actions
    if (dx > 0) { setOffset(0); return }
    setOffset(Math.max(dx, -SNAP * 2))
  }

  function onTouchEnd() {
    if (offset < -threshold) {
      setOffset(-SNAP)
      setRevealed("right")
    } else {
      reset()
    }
    startXRef.current = null
  }

  function handleEdit() {
    reset()
    onEdit?.()
  }

  function handleDelete() {
    reset()
    onDelete?.()
  }

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-lg">
      {/* Action buttons revealed on swipe-left */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center gap-1 px-2"
        style={{ width: SNAP }}
      >
        {onEdit && (
          <button
            onClick={handleEdit}
            className="flex h-full flex-1 flex-col items-center justify-center gap-1 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 transition-colors"
          >
            <Edit className="h-4 w-4" />
            <span className="text-[9px] font-medium">Editar</span>
          </button>
        )}
        {onDelete && (
          <button
            onClick={handleDelete}
            className="flex h-full flex-1 flex-col items-center justify-center gap-1 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-[9px] font-medium">Borrar</span>
          </button>
        )}
      </div>

      {/* Main content — slides left on swipe */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={revealed ? reset : undefined}
        style={{
          transform: `translateX(${offset}px)`,
          transition: startXRef.current === null ? "transform 0.2s ease" : "none",
        }}
        className={cn("relative bg-background", revealed && "cursor-pointer")}
      >
        {children}
      </div>
    </div>
  )
}
