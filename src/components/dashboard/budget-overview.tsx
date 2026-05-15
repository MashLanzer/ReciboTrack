"use client"

import { useMemo, useState } from "react"
import { useBudgets, useUpsertBudget, useDeleteBudget } from "@/hooks/use-budgets"
import { useCategories } from "@/hooks/use-categories"
import { useExpensesForMonth } from "@/hooks/use-expenses"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Plus, Trash2, AlertTriangle, Copy, Loader2, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export function BudgetOverview() {
  const now = new Date()
  // Last month for the "copy from previous" feature
  const prevMonth = now.getMonth() === 0
    ? { year: now.getFullYear() - 1, month: 12 }
    : { year: now.getFullYear(), month: now.getMonth() }

  const { data: budgets = [], isLoading: loadingBudgets } = useBudgets()
  const { data: categories = [], isLoading: loadingCats } = useCategories()
  const { data: expenses = [], isLoading: loadingExp } = useExpensesForMonth(now.getFullYear(), now.getMonth() + 1)
  const { data: prevExpenses = [], isLoading: loadingPrev } = useExpensesForMonth(prevMonth.year, prevMonth.month)
  const upsertBudget = useUpsertBudget()
  const deleteBudget = useDeleteBudget()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ categoryId: "", monthlyLimit: "", currency: "USD", id: "" })
  const [copyingPrev, setCopyingPrev] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Group last month's spending by category
  const prevByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    prevExpenses.forEach((e) => {
      map[e.category] = (map[e.category] ?? 0) + e.total
    })
    return Object.entries(map)
      .filter(([, total]) => total > 0)
      .sort((a, b) => b[1] - a[1])
  }, [prevExpenses])

  async function handleCopyFromPrev() {
    if (prevByCategory.length === 0) {
      toast.info("Sin gastos el mes pasado para sugerir presupuestos")
      return
    }
    setCopyingPrev(true)
    try {
      // Round up to nearest 10 for a comfortable budget
      await Promise.all(
        prevByCategory.map(([categoryId, total]) =>
          upsertBudget.mutateAsync({
            categoryId,
            monthlyLimit: Math.ceil(total / 10) * 10,
            currency: "USD",
          })
        )
      )
      toast.success(`${prevByCategory.length} presupuestos creados desde el mes anterior`)
      setPreviewOpen(false)
    } catch {
      toast.error("Error al crear presupuestos")
    } finally {
      setCopyingPrev(false)
    }
  }

  const categorySpend = useMemo(() => {
    const map: Record<string, number> = {}
    expenses.forEach((e) => {
      map[e.category] = (map[e.category] ?? 0) + e.total
    })
    return map
  }, [expenses])

  const totalBudget = budgets.reduce((acc, b) => acc + b.monthlyLimit, 0)
  const totalSpent = budgets.reduce((acc, b) => acc + (categorySpend[b.categoryId] ?? 0), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await upsertBudget.mutateAsync({
        id: form.id || undefined,
        categoryId: form.categoryId,
        monthlyLimit: parseFloat(form.monthlyLimit),
        currency: form.currency,
      })
      toast.success("Presupuesto guardado")
      setDialogOpen(false)
      setForm({ categoryId: "", monthlyLimit: "", currency: "USD", id: "" })
    } catch {
      toast.error("Error al guardar")
    }
  }

  if (loadingBudgets || loadingCats || loadingExp || loadingPrev) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Empty state: suggest copying from last month */}
      {budgets.length === 0 && prevByCategory.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Copy className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Sin presupuestos configurados</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                El mes pasado gastaste en {prevByCategory.length} categorías. ¿Quieres crear presupuestos automáticamente?
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="gap-1.5" onClick={() => setPreviewOpen(true)}>
              <Copy className="h-3.5 w-3.5" />
              Ver sugerencias
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
              Crear manualmente
            </Button>
          </div>
        </div>
      )}

      {budgets.length > 0 && (
        <Card className="grain">
          <CardContent className="pt-6 pb-6">
            <div className="flex justify-between mb-3">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Presupuesto total</p>
                <p className="font-serif text-3xl tabular-nums mt-1">{formatCurrency(totalBudget)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Gastado</p>
                <p className="tabular-nums font-semibold">{formatCurrency(totalSpent)}</p>
              </div>
            </div>
            <Progress value={Math.min((totalSpent / totalBudget) * 100, 100)} className="h-2" />
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {budgets.map((budget) => {
          const cat = categories.find((c) => c.id === budget.categoryId)
          const spent = categorySpend[budget.categoryId] ?? 0
          const pct = budget.monthlyLimit > 0 ? (spent / budget.monthlyLimit) * 100 : 0
          const over = pct > 100

          return (
            <Card key={budget.id} className={cn(over && "border-destructive/50")}>
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat?.icon ?? "📦"}</span>
                    <div>
                      <p className="text-sm font-medium">{cat?.name ?? budget.categoryId}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatCurrency(spent)} / {formatCurrency(budget.monthlyLimit)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {over && <AlertTriangle className="h-4 w-4 text-destructive" />}
                    <p className={cn("text-sm font-semibold tabular-nums", over ? "text-destructive" : pct > 80 ? "text-yellow-600" : "text-green-600")}>
                      {pct.toFixed(0)}%
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteBudget.mutate(budget.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <Progress
                  value={Math.min(pct, 100)}
                  className={cn("h-1.5", over ? "[&>div]:bg-destructive" : pct > 80 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-green-500")}
                />
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex gap-2">
        <Button className="flex-1 gap-2" variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Agregar presupuesto
        </Button>
        {prevByCategory.length > 0 && (
          <Button variant="outline" className="gap-1.5 text-muted-foreground" onClick={() => setPreviewOpen(true)}>
            <Copy className="h-4 w-4" />
            Mes anterior
          </Button>
        )}
      </div>

      {/* Preview: copy from last month */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Presupuestos sugeridos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Basados en tu gasto real del mes anterior. Los límites se redondean al múltiplo de 10 más cercano hacia arriba.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {prevByCategory.map(([catId, total]) => {
                const cat = categories.find((c) => c.id === catId)
                const suggested = Math.ceil(total / 10) * 10
                return (
                  <div key={catId} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span>{cat?.icon ?? "📦"}</span>
                      <span className="text-sm font-medium">{cat?.name ?? catId}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground tabular-nums">Gasto: {formatCurrency(total)}</p>
                      <p className="text-sm font-semibold tabular-nums text-primary">Límite: {formatCurrency(suggested)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setPreviewOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1 gap-1.5" onClick={handleCopyFromPrev} disabled={copyingPrev}>
                {copyingPrev ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Crear todos
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo presupuesto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })} required>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Límite mensual</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={form.monthlyLimit}
                onChange={(e) => setForm({ ...form, monthlyLimit: e.target.value })}
                className="tabular-nums"
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={upsertBudget.isPending || !form.categoryId}>
                Guardar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
