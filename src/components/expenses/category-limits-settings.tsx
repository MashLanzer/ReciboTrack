"use client"

import { useState, useMemo } from "react"
import { useCategories } from "@/hooks/use-categories"
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings"
import { useExpenses } from "@/hooks/use-expenses"
import { formatCurrency } from "@/lib/utils"
import { startOfMonth, endOfMonth } from "date-fns"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Gauge } from "lucide-react"

export function CategoryLimitsSettings() {
  const { data: categories = [] } = useCategories()
  const { data: settings } = useUserSettings()
  const updateSettings = useUpdateUserSettings()

  const now = new Date()
  const { data: result } = useExpenses({
    startDate: startOfMonth(now),
    endDate: endOfMonth(now),
    sort: "date_desc",
  })
  const expenses = result?.expenses ?? []

  // Totals per category this month
  const monthlyTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    expenses.forEach(e => {
      totals[e.category] = (totals[e.category] ?? 0) + e.total
    })
    return totals
  }, [expenses])

  const [limits, setLimits] = useState<Record<string, string>>(() => {
    const existing = settings?.categoryLimits ?? {}
    const init: Record<string, string> = {}
    categories.forEach(cat => {
      init[cat.id] = existing[cat.id] != null ? String(existing[cat.id]) : ""
    })
    return init
  })

  // Sync new categories into local state when categories load
  useMemo(() => {
    const existing = settings?.categoryLimits ?? {}
    setLimits(prev => {
      const next = { ...prev }
      categories.forEach(cat => {
        if (!(cat.id in next)) {
          next[cat.id] = existing[cat.id] != null ? String(existing[cat.id]) : ""
        }
      })
      return next
    })
  }, [categories, settings?.categoryLimits])

  async function handleSave() {
    const parsed: Record<string, number> = {}
    for (const [catId, val] of Object.entries(limits)) {
      const n = parseFloat(val)
      if (!isNaN(n) && n > 0) parsed[catId] = n
    }
    try {
      await updateSettings.mutateAsync({ categoryLimits: parsed })
      toast.success("Límites guardados")
    } catch {
      toast.error("Error al guardar los límites")
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          Límites mensuales por categoría
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Recibirás un aviso al superar el 80% y una alerta al superar el 100%
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {categories.map(cat => {
            const limit = parseFloat(limits[cat.id] ?? "") || 0
            const spent = monthlyTotals[cat.id] ?? 0
            const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
            const isOver = limit > 0 && spent >= limit
            const isWarning = limit > 0 && pct >= 80 && !isOver

            return (
              <div key={cat.id} className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-base shrink-0">{cat.icon}</span>
                  <span className="flex-1 text-sm font-medium min-w-0 truncate">{cat.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Sin límite"
                      value={limits[cat.id] ?? ""}
                      onChange={e => setLimits(prev => ({ ...prev, [cat.id]: e.target.value }))}
                      className="h-7 w-28 text-xs tabular-nums text-right"
                    />
                  </div>
                </div>
                {limit > 0 && (
                  <div className="pl-9 space-y-1">
                    <Progress
                      value={pct}
                      className={`h-1.5 ${isOver ? "[&>div]:bg-destructive" : isWarning ? "[&>div]:bg-amber-500" : ""}`}
                    />
                    <div className="flex items-center justify-between text-[10px] tabular-nums text-muted-foreground">
                      <span className={isOver ? "text-destructive font-medium" : isWarning ? "text-amber-600 font-medium" : ""}>
                        {formatCurrency(spent)} gastado
                      </span>
                      <span>de {formatCurrency(limit)}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <Button
          className="w-full"
          onClick={handleSave}
          disabled={updateSettings.isPending}
        >
          Guardar límites
        </Button>
      </CardContent>
    </Card>
  )
}
