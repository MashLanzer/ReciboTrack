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
  /** Play a one-shot swipe hint animation to show the row is swipeable */
  showHint?: boolean
}

// Width of the delete-only zone (right side, red)
const DELETE_SNAP = 80

// Width of the edit+delete zone when both actions are present
const EDIT_DELETE_SNAP = 160

export function SwipeableRow({ children, onEdit, onDelete, disabled = false, threshold = 60, showHint = false }: SwipeableRowProps) {
  const startXRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)
  const [offset, setOffset] = useState(0)
  const [revealed, setRevealed] = useState<"left" | "right" | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Snap distance: if both edit and delete are present, snap wider
  const SNAP = onEdit && onDelete ? EDIT_DELETE_SNAP : DELETE_SNAP

  const reset = useCallback(() => {
    setOffset(0)
    setRevealed(null)
  }, [])

  function onTouchStart(e: React.TouchEvent) {
    if (disabled) return
    startXRef.current = e.touches[0].clientX
    isDraggingRef.current = false
  }

  function onTouchMove(e: React.TouchEvent) {
    if (disabled || startXRef.current === null) return
    const dx = e.touches[0].clientX - startXRef.current

    // Only allow swipe left (negative dx) to reveal right actions
    if (dx > 0) {
      if (!revealed) { setOffset(0); return }
      // If already revealed, allow swiping back right to reset
      setOffset(Math.min(0, -SNAP + dx))
      return
    }

    isDraggingRef.current = true
    // Resist going beyond 2× snap
    setOffset(Math.max(dx, -SNAP * 1.3))
  }

  function onTouchEnd() {
    if (isDraggingRef.current) {
      if (offset < -threshold) {
        setOffset(-SNAP)
        setRevealed("right")
      } else {
        reset()
      }
    } else if (revealed) {
      // Tap on sliding content while revealed — reset
      reset()
    }
    startXRef.current = null
    isDraggingRef.current = false
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation()
    reset()
    onEdit?.()
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    reset()
    onDelete?.()
  }

  const hasActions = onEdit || onDelete

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-xl">
      {/* ── Action zone behind the card (revealed on swipe-left) ── */}
      {hasActions && (
        <div className="absolute right-0 top-0 bottom-0 flex items-stretch">
          {/* Edit action — blue, only when onEdit is provided */}
          {onEdit && (
            <button
              onClick={handleEdit}
              className="flex w-20 flex-col items-center justify-center gap-1 bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 transition-colors"
            >
              <Edit className="h-4 w-4" />
              <span className="text-[10px] font-semibold">Editar</span>
            </button>
          )}
          {/* Delete action — red destructive, spec: absolute right-0 top-0 bottom-0 w-20 bg-destructive */}
          {onDelete && (
            <button
              onClick={handleDelete}
              className="flex w-20 flex-col items-center justify-center gap-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80 transition-colors rounded-r-xl"
            >
              <Trash2 className="h-4 w-4" />
              <span className="text-[10px] font-semibold">Eliminar</span>
            </button>
          )}
        </div>
      )}

      {/* ── Main card — slides left to reveal actions ── */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={revealed ? (e) => { e.stopPropagation(); reset() } : undefined}
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDraggingRef.current ? "none" : "transform 0.2s ease",
          willChange: "transform",
        }}
        className={cn(
          // z-10 keeps the card on top of action buttons — no rounded-xl here,
          // the outer overflow-hidden + rounded-xl handles the border-radius clipping
          "relative z-10 bg-background",
          revealed && "cursor-pointer select-none",
          // One-shot hint animation only when not dragging and not revealed
          showHint && !disabled && !revealed && offset === 0 && "swipe-hint-anim",
        )}
      >
        {children}
      </div>
    </div>
  )
}
