"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { collection, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "@/hooks/use-auth"
import { useCategories } from "@/hooks/use-categories"
import { useGoals, useAddGoal, useUpdateGoalProgress, useDeleteGoal, type GoalInput, type GoalType } from "@/hooks/use-goals"
import { formatCurrency, getCurrentMonthRange, getPreviousMonthRange, percentChange } from "@/lib/utils"
import { subMonths, format, startOfMonth, endOfMonth, getDate, getDaysInMonth } from "date-fns"
import { es } from "date-fns/locale"
import type { Expense } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { TrendingUp, TrendingDown, Minus, Plus, Trash2, Target, AlertTriangle, Check } from "lucide-react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts"
import { CURRENCIES } from "@/lib/constants"

// ─── Data hooks ────────────────────────────────────────────────────────────────

function use6MonthExpenses() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["expenses-6m-analytics", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return []
      const start = startOfMonth(subMonths(new Date(), 5))
      const col = collection(getFirebaseDb(), "users", user.uid, "expenses")
      const q = query(col, where("date", ">=", Timestamp.fromDate(start)), orderBy("date", "desc"))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)
    },
  })
}

function usePrevMonthExpenses() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["expenses-prevmonth", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return []
      const { start, end } = getPreviousMonthRange()
      const col = collection(getFirebaseDb(), "users", user.uid, "expenses")
      const q = query(col,
        where("date", ">=", Timestamp.fromDate(start)),
        where("date", "<=", Timestamp.fromDate(end)),
        orderBy("date", "desc")
      )
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)
    },
  })
}

// ─── Components ────────────────────────────────────────────────────────────────

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" /> 0%</span>
  const positive = value > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? "text-destructive" : "text-green-600"}`}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data: all6 = [], isLoading } = use6MonthExpenses()
  const { data: prev = [] } = usePrevMonthExpenses()
  const { data: categories = [] } = useCategories()
  const { data: goals = [], isLoading: goalsLoading } = useGoals()
  const addGoal = useAddGoal()
  const updateProgress = useUpdateGoalProgress()
  const deleteGoal = useDeleteGoal()

  const [goalDialog, setGoalDialog] = useState(false)
  const [progressDialog, setProgressDialog] = useState<{ id: string; current: number; name: string } | null>(null)
  const [progressInput, setProgressInput] = useState("")
  const [goalForm, setGoalForm] = useState<GoalInput>({
    type: "saving", name: "", targetAmount: 0, currentAmount: 0, currency: "USD", deadline: null,
  })

  const today = new Date()
  const { start: monthStart, end: monthEnd } = getCurrentMonthRange()
  const dayOfMonth = getDate(today)
  const daysInMonth = getDaysInMonth(today)

  const current = useMemo(
    () => all6.filter((e) => { const d = e.date.toDate(); return d >= monthStart && d <= monthEnd }),
    [all6, monthStart, monthEnd]
  )
  const currentTotal = current.reduce((a, e) => a + e.total, 0)
  const prevTotal = prev.reduce((a, e) => a + e.total, 0)

  // ── #15 Comparativa mes actual vs anterior por categoría ──────────────────
  const categoryComparison = useMemo(() => {
    const currMap: Record<string, { total: number; count: number }> = {}
    const prevMap: Record<string, { total: number; count: number }> = {}
    current.forEach((e) => {
      if (!currMap[e.category]) currMap[e.category] = { total: 0, count: 0 }
      currMap[e.category].total += e.total
      currMap[e.category].count++
    })
    prev.forEach((e) => {
      if (!prevMap[e.category]) prevMap[e.category] = { total: 0, count: 0 }
      prevMap[e.category].total += e.total
      prevMap[e.category].count++
    })
    const allCats = new Set([...Object.keys(currMap), ...Object.keys(prevMap)])
    return [...allCats].map((id) => {
      const cat = categories.find((c) => c.id === id)
      const c = currMap[id] ?? { total: 0, count: 0 }
      const p = prevMap[id] ?? { total: 0, count: 0 }
      return {
        id, name: cat?.name ?? id, icon: cat?.icon ?? "📦", color: cat?.color ?? "#6b7280",
        current: c.total, currentCount: c.count,
        prev: p.total, prevCount: p.count,
        delta: percentChange(c.total, p.total),
      }
    }).sort((a, b) => b.current - a.current)
  }, [current, prev, categories])

  // Chart data for comparison
  const comparisonChartData = categoryComparison.slice(0, 8).map((c) => ({
    name: c.icon + " " + c.name.slice(0, 8),
    "Este mes": c.current,
    "Mes anterior": c.prev,
    color: c.color,
  }))

  // ── #14 Límite diario ─────────────────────────────────────────────────────
  const dailyLimitGoal = goals.find((g) => g.type === "daily_limit" && g.isActive)
  const dailySpend = useMemo(() => {
    const todayStr = format(today, "yyyy-MM-dd")
    return current
      .filter((e) => format(e.date.toDate(), "yyyy-MM-dd") === todayStr)
      .reduce((a, e) => a + e.total, 0)
  }, [current, today])

  const dailyAvgThisMonth = currentTotal / Math.max(dayOfMonth, 1)
  const projectedMonthEnd = dailyAvgThisMonth * daysInMonth

  // ── #13 Metas de ahorro ────────────────────────────────────────────────────
  const savingGoals = goals.filter((g) => g.type === "saving")

  async function handleAddGoal() {
    if (!goalForm.name || goalForm.targetAmount <= 0) {
      toast.error("Completa nombre y monto objetivo")
      return
    }
    try {
      await addGoal.mutateAsync(goalForm)
      toast.success("Meta creada")
      setGoalDialog(false)
      setGoalForm({ type: "saving", name: "", targetAmount: 0, currentAmount: 0, currency: "USD", deadline: null })
    } catch {
      toast.error("Error al crear meta")
    }
  }

  async function handleUpdateProgress() {
    if (!progressDialog) return
    const amount = parseFloat(progressInput)
    if (isNaN(amount) || amount < 0) { toast.error("Monto inválido"); return }
    try {
      await updateProgress.mutateAsync({ id: progressDialog.id, currentAmount: amount })
      toast.success("Progreso actualizado")
      setProgressDialog(null)
      setProgressInput("")
    } catch {
      toast.error("Error al actualizar")
    }
  }

  async function handleDeleteGoal(id: string) {
    if (!confirm("¿Eliminar esta meta?")) return
    try {
      await deleteGoal.mutateAsync(id)
      toast.success("Meta eliminada")
    } catch {
      toast.error("Error al eliminar")
    }
  }

  if (isLoading) return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-5">
      {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
    </div>
  )

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-5">
      <h1 className="font-serif text-2xl">Análisis</h1>

      {/* ── #15 Comparativa este mes vs anterior ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Este mes vs mes anterior
            </CardTitle>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {format(monthStart, "MMM", { locale: es })} <span className="font-semibold text-foreground">{formatCurrency(currentTotal)}</span>
                {" · "}
                {format(subMonths(today, 1), "MMM", { locale: es })} <span className="font-semibold text-foreground">{formatCurrency(prevTotal)}</span>
              </p>
              <DeltaBadge value={percentChange(currentTotal, prevTotal)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Bar chart */}
          <div className="px-2 pb-2">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={comparisonChartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} width={32} />
                <Tooltip
                  formatter={(v) => formatCurrency(Number(v))}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                />
                <Bar dataKey="Mes anterior" radius={[3, 3, 0, 0]} fillOpacity={0.25} fill="hsl(var(--foreground))" />
                <Bar dataKey="Este mes" radius={[3, 3, 0, 0]} fillOpacity={0.85} fill="hsl(var(--foreground))" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Comparison table */}
          <table className="w-full text-sm border-t">
            <thead>
              <tr className="border-b">
                <th className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-4 py-2">Categoría</th>
                <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-2">Anterior</th>
                <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-2">Actual</th>
                <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-4 py-2">Δ</th>
              </tr>
            </thead>
            <tbody>
              {categoryComparison.map((cat, i) => (
                <tr key={cat.id} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                      <span className="text-xs">{cat.icon}</span>
                      <span className="text-xs font-medium truncate max-w-[90px]">{cat.name}</span>
                    </div>
                  </td>
                  <td className="text-right px-2 py-2 tabular-nums text-xs text-muted-foreground">{cat.prev > 0 ? formatCurrency(cat.prev) : "—"}</td>
                  <td className="text-right px-2 py-2 tabular-nums text-xs font-semibold">{cat.current > 0 ? formatCurrency(cat.current) : "—"}</td>
                  <td className="text-right px-4 py-2">
                    {cat.prev > 0 || cat.current > 0 ? <DeltaBadge value={cat.delta} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30">
                <td className="px-4 py-2 text-xs font-semibold">Total</td>
                <td className="text-right px-2 py-2 tabular-nums text-xs text-muted-foreground">{formatCurrency(prevTotal)}</td>
                <td className="text-right px-2 py-2 tabular-nums text-xs font-bold">{formatCurrency(currentTotal)}</td>
                <td className="text-right px-4 py-2"><DeltaBadge value={percentChange(currentTotal, prevTotal)} /></td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* ── #14 Límite de gasto diario ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Gasto diario de hoy</CardTitle>
            {!dailyLimitGoal && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => { setGoalForm({ type: "daily_limit", name: "Límite diario", targetAmount: 50, currentAmount: 0, currency: "USD", deadline: null }); setGoalDialog(true) }}>
                <Plus className="h-3 w-3" /> Configurar límite
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Hoy</p>
              <p className="tabular-nums text-lg font-bold mt-0.5">{formatCurrency(dailySpend)}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Promedio/día</p>
              <p className="tabular-nums text-lg font-bold mt-0.5">{formatCurrency(dailyAvgThisMonth)}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Proyectado</p>
              <p className="tabular-nums text-lg font-bold mt-0.5">{formatCurrency(projectedMonthEnd)}</p>
            </div>
          </div>

          {dailyLimitGoal && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {dailySpend >= dailyLimitGoal.targetAmount
                    ? <AlertTriangle className="h-4 w-4 text-destructive" />
                    : <Check className="h-4 w-4 text-green-600" />}
                  <span className="text-xs font-medium">
                    Límite: {formatCurrency(dailyLimitGoal.targetAmount)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatCurrency(Math.max(dailyLimitGoal.targetAmount - dailySpend, 0))} restante
                  </span>
                  <button onClick={() => handleDeleteGoal(dailyLimitGoal.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <Progress
                value={Math.min((dailySpend / dailyLimitGoal.targetAmount) * 100, 100)}
                className="h-2"
              />
              {dailySpend >= dailyLimitGoal.targetAmount && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Has superado tu límite diario por {formatCurrency(dailySpend - dailyLimitGoal.targetAmount)}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── #13 Metas de ahorro ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Metas de ahorro</CardTitle>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
              onClick={() => { setGoalForm({ type: "saving", name: "", targetAmount: 0, currentAmount: 0, currency: "USD", deadline: null }); setGoalDialog(true) }}>
              <Plus className="h-3 w-3" /> Nueva meta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {goalsLoading ? (
            <Skeleton className="h-20 rounded-lg" />
          ) : savingGoals.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin metas de ahorro todavía</p>
              <p className="text-xs mt-1">Define cuánto quieres ahorrar y lleva el control</p>
            </div>
          ) : (
            <div className="space-y-4">
              {savingGoals.map((goal) => {
                const pct = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0
                const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0)
                const completed = goal.currentAmount >= goal.targetAmount
                const daysLeft = goal.deadline
                  ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86_400_000)
                  : null
                return (
                  <div key={goal.id} className="space-y-2 p-3 rounded-xl border bg-muted/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {completed && <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                          <p className="text-sm font-medium truncate">{goal.name}</p>
                        </div>
                        {goal.deadline && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {daysLeft !== null && daysLeft > 0
                              ? `${daysLeft} días restantes · ${format(new Date(goal.deadline), "dd MMM yyyy", { locale: es })}`
                              : daysLeft === 0 ? "Vence hoy" : "Vencida"}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => { setProgressDialog({ id: goal.id, current: goal.currentAmount, name: goal.name }); setProgressInput(goal.currentAmount.toString()) }}
                          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:border-foreground/30 transition-colors"
                        >
                          Actualizar
                        </button>
                        <button onClick={() => handleDeleteGoal(goal.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <div className="flex items-center justify-between text-xs tabular-nums">
                      <span className="font-semibold">{formatCurrency(goal.currentAmount, goal.currency)}</span>
                      <span className="text-muted-foreground">
                        {completed ? "¡Meta alcanzada! 🎉" : `${formatCurrency(remaining, goal.currency)} restante`}
                      </span>
                      <span className="text-muted-foreground">{formatCurrency(goal.targetAmount, goal.currency)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Dialog nueva meta / límite ── */}
      <Dialog open={goalDialog} onOpenChange={setGoalDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {goalForm.type === "saving" ? "Nueva meta de ahorro" : "Configurar límite diario"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            {goalForm.type === "saving" && (
              <div className="space-y-1.5">
                <Label>Nombre de la meta</Label>
                <Input
                  placeholder="Ej. Vacaciones, Laptop, Fondo de emergencia..."
                  value={goalForm.name}
                  onChange={(e) => setGoalForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{goalForm.type === "saving" ? "Monto objetivo" : "Límite por día"}</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={goalForm.targetAmount || ""}
                  onChange={(e) => setGoalForm((f) => ({ ...f, targetAmount: parseFloat(e.target.value) || 0 }))}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <Select value={goalForm.currency} onValueChange={(v) => setGoalForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {goalForm.type === "saving" && (
              <>
                <div className="space-y-1.5">
                  <Label>Ahorro inicial (opcional)</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={goalForm.currentAmount || ""}
                    onChange={(e) => setGoalForm((f) => ({ ...f, currentAmount: parseFloat(e.target.value) || 0 }))}
                    className="tabular-nums" placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha límite (opcional)</Label>
                  <Input
                    type="date"
                    value={goalForm.deadline ?? ""}
                    onChange={(e) => setGoalForm((f) => ({ ...f, deadline: e.target.value || null }))}
                  />
                </div>
              </>
            )}
            <Button className="w-full" onClick={handleAddGoal} disabled={addGoal.isPending}>
              {goalForm.type === "saving" ? "Crear meta" : "Guardar límite"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog actualizar progreso ── */}
      <Dialog open={!!progressDialog} onOpenChange={(o) => !o && setProgressDialog(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Actualizar "{progressDialog?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label>Monto ahorrado actual</Label>
              <Input
                type="number" step="0.01" min="0"
                value={progressInput}
                onChange={(e) => setProgressInput(e.target.value)}
                className="tabular-nums text-lg"
                autoFocus
              />
            </div>
            <Button className="w-full" onClick={handleUpdateProgress} disabled={updateProgress.isPending}>
              Guardar progreso
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
