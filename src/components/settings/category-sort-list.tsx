"use client"

import { useState, useRef, type ReactNode } from "react"
import type { CategoryDoc } from "@/types"
import { useReorderCategories } from "@/hooks/use-categories"
import { GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  categories: CategoryDoc[]
  label?: string
  /** Optional slot rendered after the category name (e.g. edit/delete buttons) */
  renderActions?: (cat: CategoryDoc) => ReactNode
}

export function CategorySortList({ categories, label, renderActions }: Props) {
  const [items, setItems] = useState<CategoryDoc[]>(categories)
  const dragIndex = useRef<number | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const reorder = useReorderCategories()

  // Sync if parent categories prop changes (e.g. after a refetch)
  // Only update if IDs actually changed to avoid losing drag state mid-session
  const prevIds = useRef<string[]>(categories.map((c) => c.id))
  const newIds = categories.map((c) => c.id)
  if (
    newIds.length !== prevIds.current.length ||
    newIds.some((id, i) => id !== prevIds.current[i])
  ) {
    prevIds.current = newIds
    setItems(categories)
  }

  function handleDragStart(e: React.DragEvent, index: number) {
    dragIndex.current = index
    setDraggingId(items[index].id)
    e.dataTransfer.effectAllowed = "move"
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setOverIndex(index)
  }

  function handleDragLeave() {
    setOverIndex(null)
  }

  function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault()
    const from = dragIndex.current
    if (from === null || from === dropIndex) {
      setDraggingId(null)
      setOverIndex(null)
      dragIndex.current = null
      return
    }

    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(dropIndex, 0, moved)
    setItems(next)
    reorder.mutate(next.map((c) => c.id))

    dragIndex.current = null
    setDraggingId(null)
    setOverIndex(null)
  }

  function handleDragEnd() {
    dragIndex.current = null
    setDraggingId(null)
    setOverIndex(null)
  }

  if (items.length === 0) return null

  return (
    <div>
      {label && (
        <div className="flex items-center gap-3 mb-3">
          <div className="h-px flex-1 bg-border/50" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">
            {label}
          </p>
          <div className="h-px flex-1 bg-border/50" />
        </div>
      )}
      <div className="grid gap-1.5">
        {items.map((cat, index) => (
          <div
            key={cat.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              "group flex items-center gap-3 py-2.5 px-3 rounded-xl border bg-card border-l-[3px] transition-all duration-150 hover:bg-muted/40 hover:shadow-sm select-none",
              draggingId === cat.id && "opacity-50",
              overIndex === index && draggingId !== cat.id && "ring-2 ring-primary/50 border-primary/40"
            )}
            style={{ borderLeftColor: cat.color }}
          >
            {/* Drag handle */}
            <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0 group-hover:text-muted-foreground/70 transition-colors cursor-grab active:cursor-grabbing" />

            {/* Icon */}
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center text-base shrink-0"
              style={{ backgroundColor: `${cat.color}20` }}
            >
              {cat.icon}
            </div>

            {/* Name */}
            <p className="text-sm font-medium flex-1 truncate">{cat.name}</p>

            {/* Optional actions (edit/delete for custom categories) */}
            {renderActions ? (
              renderActions(cat)
            ) : (
              <div className="h-2 w-2 rounded-full shrink-0 opacity-50" style={{ backgroundColor: cat.color }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
