"use client"

import { useState } from "react"
import { useWatchlist } from "@/hooks/use-watchlist"
import { useCategories } from "@/hooks/use-categories"
import { useExpensesForMonth } from "@/hooks/use-expenses"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, EyeOff, AlertTriangle, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function CategoryWatchlist() {
  const { entries, ready, addToWatchlist, removeFromWatchlist, updateThreshold, isWatched } = useWatchlist()
  const { data: categories = [], isLoading: loadingCats } = useCategories()

  const now = new Date()
  const { data: expenses = [], isLoading: loadingExp } = useExpensesForMonth(
    now.getFullYear(),
    now.getMonth() + 1
  )

  const [addCatId, setAddCatId] = useState("")
  const [addThreshold, setAddThreshold] = useState("")

  const isLoading = loadingCats || loadingExp || !ready

  // Build spend map for this month
  const spendMap: Record<string, number> = {}
  expenses.forEach((e) => {
    spendMap[e.category] = (spendMap[e.category] ?? 0) + e.total
  })

  const watchedCategories = entries.map((entry) => {
    const cat = categories.find((c) => c.id === entry.categoryId)
    const spent = spendMap[entry.categoryId] ?? 0
    const pct = entry.alertThreshold && entry.alertThreshold > 0
      ? (spent / entry.alertThreshold) * 100
      : null
    const isAlert = pct !== null && pct >= 80
    return { ...entry, cat, spent, pct, isAlert }
  })

  const unwatchedCategories = categories.filter((c) => !isWatched(c.id))

  function handleAdd() {
    if (!addCatId) { toast.error("Selecciona una categoría"); return }
    const threshold = parseFloat(addThreshold)
    addToWatchlist(addCatId, isNaN(threshold) || threshold <= 0 ? undefined : threshold)
    setAddCatId("")
    setAddThreshold("")
    toast.success("Categoría añadida a la vigilancia")
  }

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <Eye className="h-4 w-4 text-primary" />
          Categorías en vigilancia
        </CardTitle>
        <p className="text-xs text-muted-foreground">Monitoriza categorías clave y recibe alertas</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Watched list */}
        {watchedCategories.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Sin categorías en vigilancia todavía
          </p>
        ) : (
          <div className="space-y-3">
            {watchedCategories.map(({ categoryId, cat, spent, pct, isAlert, alertThreshold }) => (
              <div key={categoryId} className={cn("rounded-xl border p-3 space-y-2", isAlert && "border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/10")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {cat && (
                      <div
                        className="h-7 w-7 flex items-center justify-center rounded-md text-base"
                        style={{ backgroundColor: `${cat.color}20` }}
                      >
                        {cat.icon}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold">{cat?.name ?? categoryId}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {formatCurrency(spent)}
                        {alertThreshold ? ` / ${formatCurrency(alertThreshold)}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAlert && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                    <button
                      onClick={() => { removeFromWatchlist(categoryId); toast.info("Categoría eliminada de vigilancia") }}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {pct !== null && (
                  <div className="space-y-1">
                    <Progress
                      value={Math.min(pct, 100)}
                      className={cn("h-1.5", pct >= 100 ? "[&>div]:bg-destructive" : pct >= 80 ? "[&>div]:bg-amber-500" : "")}
                    />
                    <p className="text-[11px] text-muted-foreground text-right">{pct.toFixed(0)}% del límite</p>
                  </div>
                )}

                {/* Inline threshold edit */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground shrink-0">Límite mes:</span>
                  <Input
                    type="number"
                    placeholder="Sin límite"
                    defaultValue={alertThreshold ?? ""}
                    className="h-6 text-[10px] px-2"
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value)
                      updateThreshold(categoryId, isNaN(val) || val <= 0 ? undefined : val)
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add new */}
        {unwatchedCategories.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Añadir categoría</p>
            <div className="flex gap-2">
              <Select value={addCatId} onValueChange={setAddCatId}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Categoría..." />
                </SelectTrigger>
                <SelectContent>
                  {unwatchedCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Límite"
                value={addThreshold}
                onChange={(e) => setAddThreshold(e.target.value)}
                className="h-8 w-24 text-xs"
              />
              <Button size="sm" className="h-8 px-2 shrink-0" onClick={handleAdd}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
