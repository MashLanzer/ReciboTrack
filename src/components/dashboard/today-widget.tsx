"use client"

import { useMemo } from "react"
import { format, differenceInDays, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useDueRecurring, useConfirmRecurring } from "@/hooks/use-recurring"
import { useGoals } from "@/hooks/use-goals"
import { useCategories } from "@/hooks/use-categories"
import { useAddExpense } from "@/hooks/use-expenses"
import { formatCurrency } from "@/lib/utils"

export function TodayWidget() {
  const { data: dueItems = [], isLoading: loadingRecurring } = useDueRecurring()
  const { data: goals = [], isLoading: loadingGoals } = useGoals()
  const { data: categories = [] } = useCategories()
  const confirmRecurring = useConfirmRecurring()
  const addExpense = useAddExpense()

  const isLoading = loadingRecurring || loadingGoals

  // Goals with deadline within 7 days
  const upcomingGoals = useMemo(() => {
    const now = new Date()
    const in7 = addDays(now, 7)
    return goals
      .filter((g) => {
        if (!g.deadline || !g.isActive) return false
        const d = new Date(g.deadline)
        return d >= now && d <= in7
      })
      .slice(0, 2)
  }, [goals])

  const dueToShow = dueItems.slice(0, 3)

  if (!isLoading && dueToShow.length === 0 && upcomingGoals.length === 0) return null

  const todayLabel = format(new Date(), "EEEE d 'de' MMMM", { locale: es })

  async function handleRegister(item: (typeof dueToShow)[0]) {
    try {
      await addExpense.mutateAsync({
        merchant: item.merchant,
        date: new Date(),
        items: [],
        subtotal: item.subtotal,
        tax: item.tax,
        total: item.total,
        paymentMethod: item.paymentMethod,
        reference: null,
        category: item.category,
        currency: item.currency,
        notes: item.notes,
        tags: item.tags,
        receiptImageUrl: null,
      })
      await confirmRecurring.mutateAsync({ id: item.id, frequency: item.frequency })
      toast.success(`"${item.merchant}" registrado`)
    } catch {
      toast.error("Error al registrar el pago")
    }
  }

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <h2 className="text-sm font-semibold">Tu día</h2>
        </div>
        <span className="text-xs text-muted-foreground capitalize">{todayLabel}</span>
      </div>

      <div className="pb-3 space-y-0.5">
        {/* Recurring payments due */}
        {isLoading ? (
          <div className="px-4 space-y-2 py-2">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {dueToShow.length > 0 && (
              <div className="px-4 pb-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 mt-1">
                  Pagos pendientes
                </p>
                <div className="space-y-1.5">
                  {dueToShow.map((item) => {
                    const cat = categories.find((c) => c.id === item.category)
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2"
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
                          style={{ backgroundColor: `${cat?.color ?? "#6b7280"}20` }}
                        >
                          {cat?.icon ?? "📦"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.merchant}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(item.total, item.currency)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs shrink-0 gap-1"
                          disabled={addExpense.isPending || confirmRecurring.isPending}
                          onClick={() => handleRegister(item)}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Registrar
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Goals with upcoming deadline */}
            {upcomingGoals.length > 0 && (
              <div className="px-4 pt-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Metas próximas
                </p>
                <div className="space-y-1.5">
                  {upcomingGoals.map((goal) => {
                    const pct = goal.targetAmount > 0
                      ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
                      : 0
                    const daysLeft = differenceInDays(new Date(goal.deadline!), new Date())
                    return (
                      <div
                        key={goal.id}
                        className="rounded-xl bg-muted/40 px-3 py-2 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{goal.name}</p>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {daysLeft === 0 ? "hoy" : `${daysLeft}d`}
                          </span>
                        </div>
                        <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-1.5 rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(goal.currentAmount, goal.currency)} de {formatCurrency(goal.targetAmount, goal.currency)} · {Math.round(pct)}%
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
