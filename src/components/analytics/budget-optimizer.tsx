"use client"

import { useState, useMemo } from "react"
import { formatCurrency } from "@/lib/utils"
import { useSetCategoryBudget } from "@/hooks/use-category-budgets"
import { useCategories } from "@/hooks/use-categories"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { Expense } from "@/types"

// Category ID → bucket mapping
const NEEDS_KEYWORDS = [
  "hogar", "servicios", "salud", "transporte", "supermercado",
  "alimentacion", "alquiler", "rent", "utilities", "groceries", "health", "transport",
  "educacion", "seguro", "insurance",
]
const WANTS_KEYWORDS = [
  "restaurante", "comida", "ocio", "entretenimiento", "compras", "shopping",
  "suscripciones", "subscriptions", "restaurant", "entertainment", "beauty", "belleza",
  "ropa", "viaje", "travel",
]
// Everything else → savings

type Bucket = "needs" | "wants" | "savings"

function classifyCategory(catId: string, catName: string): Bucket {
  const key = (catId + " " + catName).toLowerCase()
  if (NEEDS_KEYWORDS.some(k => key.includes(k))) return "needs"
  if (WANTS_KEYWORDS.some(k => key.includes(k))) return "wants"
  return "savings"
}

interface BucketInfo {
  bucket: Bucket
  label: string
  targetPct: number
  emoji: string
  color: string
}

const BUCKETS: BucketInfo[] = [
  { bucket: "needs",   label: "Necesidades", targetPct: 50, emoji: "🏠", color: "bg-blue-500" },
  { bucket: "wants",   label: "Deseos",      targetPct: 30, emoji: "🛍️", color: "bg-violet-500" },
  { bucket: "savings", label: "Ahorro",      targetPct: 20, emoji: "💰", color: "bg-emerald-500" },
]

interface Props {
  expenses: Expense[]
}

export function BudgetOptimizer({ expenses }: Props) {
  const { data: categories = [] } = useCategories()
  const setBudget = useSetCategoryBudget()
  const [income, setIncome] = useState("")
  const [generated, setGenerated] = useState(false)
  const [applying, setApplying] = useState(false)

  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  // Compute actual spend per bucket from current month
  const actualByBucket = useMemo(() => {
    const totals: Record<Bucket, number> = { needs: 0, wants: 0, savings: 0 }
    const catsByBucket: Record<Bucket, { id: string; name: string; total: number }[]> = {
      needs: [], wants: [], savings: [],
    }

    const byCategory = new Map<string, number>()
    for (const e of expenses) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.total)
    }

    for (const [catId, total] of byCategory) {
      const cat = categories.find(c => c.id === catId)
      const bucket = classifyCategory(catId, cat?.name ?? catId)
      totals[bucket] += total
      catsByBucket[bucket].push({ id: catId, name: cat?.name ?? catId, total })
    }

    return { totals, catsByBucket }
  }, [expenses, categories])

  const incomeNum = parseFloat(income) || 0
  const proposal = useMemo(() => {
    if (!incomeNum) return null
    return {
      needs: incomeNum * 0.5,
      wants: incomeNum * 0.3,
      savings: incomeNum * 0.2,
    }
  }, [incomeNum])

  async function handleApplyBudget(bucket: Bucket) {
    if (!proposal) return
    const cats = actualByBucket.catsByBucket[bucket]
    if (!cats.length) { toast.info("Sin categorías en este grupo"); return }

    const totalActual = actualByBucket.totals[bucket]
    const budgetForBucket = proposal[bucket]

    setApplying(true)
    try {
      await Promise.all(
        cats.map(({ id }) => {
          // Distribute proportionally based on actual spend; if no spend, split evenly
          const portion = totalActual > 0
            ? (actualByBucket.catsByBucket[bucket].find(c => c.id === id)?.total ?? 0) / totalActual
            : 1 / cats.length
          const amount = Math.round(budgetForBucket * portion * 100) / 100
          return setBudget.mutateAsync({ categoryId: id, amount, currency: "USD", month })
        })
      )
      toast.success(`Presupuesto de ${BUCKETS.find(b => b.bucket === bucket)?.label} aplicado`)
    } catch {
      toast.error("Error al aplicar presupuesto")
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Herramienta</p>
        <p className="text-sm font-bold mt-0.5">Optimizador de presupuesto</p>
        <p className="text-xs text-muted-foreground mt-1">
          Basado en la regla 50/30/20 aplicada a tus patrones de gasto reales.
        </p>
      </div>

      {/* Income input */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <p className="text-xs font-medium mb-1">Ingreso mensual estimado</p>
          <Input
            type="number" inputMode="decimal"
            min={0}
            step={100}
            placeholder="Ej. 3000"
            value={income}
            onChange={e => { setIncome(e.target.value); setGenerated(false) }}
            className="h-8 text-sm tabular-nums"
          />
        </div>
        <Button
          size="sm"
          className="h-8 shrink-0"
          onClick={() => { if (incomeNum > 0) setGenerated(true) }}
          disabled={!incomeNum}
        >
          Generar propuesta
        </Button>
      </div>

      {/* Proposal */}
      {generated && proposal && (
        <div className="space-y-3">
          {BUCKETS.map(({ bucket, label, targetPct, emoji, color }) => {
            const recommended = proposal[bucket]
            const actual = actualByBucket.totals[bucket]
            const delta = actual - recommended
            const isOver = delta > 0

            return (
              <div key={bucket} className="rounded-xl border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{emoji}</span>
                    <div>
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-xs text-muted-foreground">{targetPct}% del ingreso</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] px-2"
                    onClick={() => handleApplyBudget(bucket)}
                    disabled={applying}
                  >
                    Aplicar
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recomendado</p>
                    <p className="text-xs font-bold tabular-nums mt-0.5">{formatCurrency(recommended)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actual</p>
                    <p className="text-xs font-bold tabular-nums mt-0.5">{formatCurrency(actual)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diferencia</p>
                    <p className={cn("text-xs font-bold tabular-nums mt-0.5", isOver ? "text-destructive" : "text-emerald-600")}>
                      {isOver ? "+" : "-"}{formatCurrency(Math.abs(delta))}
                    </p>
                  </div>
                </div>

                {/* Progress bar: actual vs recommended */}
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", color)}
                    style={{ width: `${Math.min((actual / Math.max(recommended, 1)) * 100, 100)}%` }}
                  />
                </div>

                {/* Categories in this bucket */}
                {actualByBucket.catsByBucket[bucket].length > 0 && (
                  <p className="text-xs text-muted-foreground truncate">
                    {actualByBucket.catsByBucket[bucket].map(c => c.name).join(", ")}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
