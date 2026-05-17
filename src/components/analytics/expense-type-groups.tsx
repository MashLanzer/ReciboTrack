"use client"

import { useMemo } from "react"
import type { Expense } from "@/types"
import type { CategoryDoc } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { Layers } from "lucide-react"

/**
 * Maps category IDs to broad type groups.
 * Extend this map to match your app's category taxonomy.
 */
const TYPE_GROUPS: Record<string, { label: string; color: string; emoji: string }> = {
  necesidades: { label: "Necesidades", color: "#3b82f6", emoji: "🏠" },
  ocio: { label: "Ocio & Lifestyle", color: "#f59e0b", emoji: "🎉" },
  ahorro: { label: "Ahorro & Inversión", color: "#22c55e", emoji: "💰" },
  salud: { label: "Salud & Bienestar", color: "#ec4899", emoji: "🏥" },
  transporte: { label: "Transporte", color: "#8b5cf6", emoji: "🚗" },
  otros: { label: "Otros", color: "#6b7280", emoji: "📦" },
}

/** Keyword-based heuristic mapping category name → group */
function inferGroup(cat: CategoryDoc): string {
  const name = cat.name.toLowerCase()
  const icon = cat.icon

  if (/comida|supermercado|hogar|servicios|agua|luz|gas|internet|alquiler|hipotec/.test(name)) return "necesidades"
  if (/ocio|entretenimiento|restaurant|bar|café|ropa|moda|belleza|viaje|viajes/.test(name)) return "ocio"
  if (/ahorro|inversión|bolsa|cripto|pension/.test(name)) return "ahorro"
  if (/salud|médico|farmacia|gym|deporte|bienestar/.test(name)) return "salud"
  if (/transporte|gasolina|combustible|auto|metro|bus|taxi|uber/.test(name)) return "transporte"
  if (/🚗|🚕|🚌/.test(icon)) return "transporte"
  if (/🏥|💊|🏋/.test(icon)) return "salud"
  if (/🎬|🎮|🎉|🍽/.test(icon)) return "ocio"
  if (/🏠|🛒|🛍/.test(icon)) return "necesidades"
  return "otros"
}

interface ExpenseTypeGroupsProps {
  expenses: Expense[]
  categories: CategoryDoc[]
}

export function ExpenseTypeGroups({ expenses, categories }: ExpenseTypeGroupsProps) {
  const groups = useMemo(() => {
    const catMap = new Map(categories.map((c) => [c.id, c]))

    // Aggregate spend per group
    const totals: Record<string, number> = {}
    expenses.forEach((e) => {
      const cat = catMap.get(e.category)
      const group = cat ? inferGroup(cat) : "otros"
      totals[group] = (totals[group] ?? 0) + e.total
    })

    const grandTotal = Object.values(totals).reduce((a, v) => a + v, 0)

    return Object.entries(TYPE_GROUPS)
      .map(([key, meta]) => ({
        key,
        ...meta,
        total: totals[key] ?? 0,
        pct: grandTotal > 0 ? ((totals[key] ?? 0) / grandTotal) * 100 : 0,
      }))
      .filter((g) => g.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [expenses, categories])

  const grandTotal = groups.reduce((a, g) => a + g.total, 0)

  if (groups.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-primary" />
          Gastos por tipo
        </CardTitle>
        <p className="text-xs text-muted-foreground">Distribución de tus gastos en grupos</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stacked bar */}
        <div className="flex h-3 w-full rounded-full overflow-hidden gap-px">
          {groups.map((g) => (
            <div
              key={g.key}
              style={{ width: `${g.pct}%`, backgroundColor: g.color, opacity: 0.85 }}
              title={`${g.label}: ${g.pct.toFixed(1)}%`}
            />
          ))}
        </div>

        {/* Group list */}
        <div className="space-y-2.5">
          {groups.map((g) => (
            <div key={g.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{g.emoji}</span>
                  <span className="text-xs font-medium">{g.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground tabular-nums">{g.pct.toFixed(1)}%</span>
                  <span className="text-xs font-semibold tabular-nums">{formatCurrency(g.total)}</span>
                </div>
              </div>
              <Progress
                value={g.pct}
                className="h-1.5"
                style={{ "--progress-color": g.color } as React.CSSProperties}
              />
            </div>
          ))}
        </div>

        <div className="pt-1 border-t flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Total clasificado</span>
          <span className="text-sm font-bold tabular-nums">{formatCurrency(grandTotal)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
