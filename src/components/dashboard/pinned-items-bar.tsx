"use client"

import { useState } from "react"
import { usePinnedItems, usePinItem, useUnpinItem } from "@/hooks/use-pinned-items"
import { useCategories } from "@/hooks/use-categories"
import { useExpensesForMonth } from "@/hooks/use-expenses"
import { formatCurrency, cn } from "@/lib/utils"
import { X, Plus } from "lucide-react"
import { toast } from "sonner"
import type { PinnedItem } from "@/types"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

function PinnedCard({ item, onUnpin }: { item: PinnedItem; onUnpin: () => void }) {
  const now = new Date()
  const { data: expenses = [] } = useExpensesForMonth(now.getFullYear(), now.getMonth() + 1)

  const spent = item.type === "category"
    ? expenses.filter((e) => e.category === item.id).reduce((s, e) => s + e.total, 0)
    : 0

  return (
    <div className="relative shrink-0 rounded-2xl border bg-card p-3 min-w-[120px] group">
      <button
        onClick={onUnpin}
        className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-muted flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity hover:bg-destructive/20 md:opacity-0 md:group-hover:opacity-100"
        aria-label="Desfijar"
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>
      <div className="text-xl mb-1">{item.icon}</div>
      <p className="text-[11px] font-semibold truncate">{item.label}</p>
      {item.type === "category" && spent > 0 && (
        <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
          {formatCurrency(spent)}
        </p>
      )}
    </div>
  )
}

function PinPickerDialog({
  open,
  onClose,
  currentIds,
}: {
  open: boolean
  onClose: () => void
  currentIds: string[]
}) {
  const { data: categories = [] } = useCategories()
  const pinItem = usePinItem()

  async function handlePin(cat: { id: string; name: string; icon: string }) {
    const item: PinnedItem = { type: "category", id: cat.id, label: cat.name, icon: cat.icon }
    try {
      await pinItem.mutateAsync(item)
      toast.success(`${cat.icon} ${cat.name} fijado`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al fijar")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Fijar en el dashboard</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">Máximo 3 ítems fijados</p>
        <div className="space-y-1 mt-2 max-h-64 overflow-y-auto">
          {categories.map((cat) => {
            const already = currentIds.includes(cat.id)
            return (
              <button
                key={cat.id}
                onClick={() => !already && handlePin(cat)}
                disabled={already || pinItem.isPending}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors text-left",
                  already
                    ? "opacity-40 cursor-not-allowed bg-muted"
                    : "hover:bg-accent/60"
                )}
              >
                <span className="text-base">{cat.icon}</span>
                <span className="font-medium">{cat.name}</span>
                {already && <span className="ml-auto text-[10px] text-muted-foreground">Fijado</span>}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function PinnedItemsBar() {
  const { data: pinned = [], isLoading } = usePinnedItems()
  const unpinItem = useUnpinItem()
  const [pickerOpen, setPickerOpen] = useState(false)

  if (isLoading) return <Skeleton className="h-20 rounded-2xl" />

  if (pinned.length === 0) {
    return (
      <button
        onClick={() => setPickerOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border/50 bg-muted/20 py-4 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
      >
        <Plus className="h-3.5 w-3.5" />
        Fija tus favoritos aquí
        <PinPickerDialog open={pickerOpen} onClose={() => setPickerOpen(false)} currentIds={[]} />
      </button>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        {pinned.map((item) => (
          <PinnedCard
            key={item.id}
            item={item}
            onUnpin={async () => {
              await unpinItem.mutateAsync(item)
              toast.success("Ítem desfijado")
            }}
          />
        ))}
        {pinned.length < 3 && (
          <button
            onClick={() => setPickerOpen(true)}
            className="shrink-0 h-16 w-16 rounded-2xl border border-border/50 bg-muted/20 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span className="text-[10px]">Fijar</span>
          </button>
        )}
      </div>
      <PinPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentIds={pinned.map((p) => p.id)}
      />
    </>
  )
}
