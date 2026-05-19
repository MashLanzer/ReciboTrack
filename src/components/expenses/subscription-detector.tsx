"use client"

import { useState } from "react"
import { useSubscriptionDetector } from "@/hooks/use-subscription-detector"
import { useAddRecurring } from "@/hooks/use-recurring"
import { useCategories } from "@/hooks/use-categories"
import { DEFAULT_CATEGORIES } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { DetectedSubscription } from "@/hooks/use-subscription-detector"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  Sparkles,
  Plus,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react"
import { addMonths } from "date-fns"

// ─── Frequency label map ──────────────────────────────────────────────────────

const FREQ_LABEL: Record<string, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  yearly: "Anual",
}

// ─── Single suggestion card ───────────────────────────────────────────────────

function SuggestionCard({
  item,
  onAdd,
  adding,
}: {
  item: DetectedSubscription
  onAdd: () => void
  adding: boolean
}) {
  const { data: categories = [] } = useCategories()
  const allCats = categories.length > 0 ? categories : DEFAULT_CATEGORIES
  const cat = allCats.find((c) => c.id === item.category)
  const confidence = item.occurrences >= 4 ? "Alta" : "Media"

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
      {/* Icon */}
      <span className="text-2xl shrink-0 leading-none">{cat?.icon ?? "📦"}</span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium truncate">{item.merchant}</p>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {FREQ_LABEL[item.frequency]}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0 h-4",
              confidence === "Alta" ? "border-green-500/50 text-green-600 dark:text-green-400" : ""
            )}
          >
            {confidence} confianza
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatCurrency(item.amount, item.currency)} · {item.occurrences} cobros detectados ·{" "}
          {cat?.name ?? item.category}
        </p>
      </div>

      {/* Add button */}
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 gap-1.5 h-7 text-xs"
        onClick={onAdd}
        disabled={adding}
      >
        {adding ? (
          <RefreshCw className="h-3 w-3 animate-spin" />
        ) : (
          <Plus className="h-3 w-3" />
        )}
        Añadir
      </Button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SubscriptionDetector() {
  const { untracked, isLoading } = useSubscriptionDetector()
  const addRecurring = useAddRecurring()
  const [expanded, setExpanded] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = untracked.filter((u) => !dismissed.has(u.merchant))

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-card p-4 space-y-2 mb-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (visible.length === 0) return null

  const preview = visible.slice(0, 2)
  const showAll = expanded ? visible : preview

  async function handleAdd(item: DetectedSubscription) {
    const key = item.merchant
    setAddingId(key)
    try {
      // Next due = next month on the same day as the last seen charge
      const nextDue = addMonths(new Date(), 1)
      nextDue.setDate(item.lastSeen.getDate())

      await addRecurring.mutateAsync({
        merchant: item.merchant,
        category: item.category,
        subtotal: item.amount,
        tax: 0,
        total: item.amount,
        paymentMethod: null,
        currency: item.currency,
        notes: `Detectado automáticamente (${item.occurrences} cobros)`,
        tags: ["auto-detectado"],
        frequency: item.frequency,
        nextDueDate: nextDue,
      })
      setDismissed((d) => new Set([...d, key]))
      toast.success(`${item.merchant} añadido a recurrentes`)
    } catch {
      toast.error("Error al añadir el recurrente")
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div className="rounded-2xl border bg-card overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-primary/5">
        {/* Icon with notification dot */}
        <div className="relative shrink-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          {/* Live notification dot */}
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-60" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">
            Suscripciones detectadas
          </p>
          <p className="text-xs text-muted-foreground">
            Cobros recurrentes no registrados aún
          </p>
        </div>

        {/* Notification count badge */}
        <span className="shrink-0 min-w-[1.5rem] h-6 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold
          tabular-nums flex items-center justify-center animate-[fadeSlideUp_0.25s_ease-out_both]">
          {visible.length}
        </span>
      </div>

      {/* Suggestions */}
      <div className="divide-y">
        {showAll.map((item) => (
          <SuggestionCard
            key={item.merchant}
            item={item}
            onAdd={() => handleAdd(item)}
            adding={addingId === item.merchant}
          />
        ))}
      </div>

      {/* Show more / less */}
      {visible.length > 2 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-center gap-1 py-2.5 text-xs text-muted-foreground
            hover:text-foreground hover:bg-muted/30 transition-colors border-t"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Mostrar menos
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Ver {visible.length - 2} más
            </>
          )}
        </button>
      )}
    </div>
  )
}
