"use client"

import { useState } from "react"
import {
  useGoals,
  useAddGoal,
  useUpdateGoalProgress,
  useDeleteGoal,
  useUpdateGoal,
} from "@/hooks/use-goals"
import type { Goal, GoalType } from "@/hooks/use-goals"
import { formatCurrency } from "@/lib/utils"
import { CURRENCIES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  Plus,
  Trash2,
  Trophy,
  Target,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
} from "lucide-react"
import { differenceInDays, parseISO, isValid } from "date-fns"
import { es } from "date-fns/locale"
import { format } from "date-fns"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysRemaining(deadline: string | null): number | null {
  if (!deadline) return null
  const d = parseISO(deadline)
  if (!isValid(d)) return null
  return differenceInDays(d, new Date())
}

function emptyForm() {
  return {
    name: "",
    targetAmount: "",
    currency: "USD",
    deadline: "",
    type: "saving" as GoalType,
  }
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({ goal }: { goal: Goal }) {
  const updateProgress = useUpdateGoalProgress()
  const deleteGoal = useDeleteGoal()
  const updateGoal = useUpdateGoal()

  const [aportarOpen, setAportarOpen] = useState(false)
  const [aportarAmount, setAportarAmount] = useState("")
  const [deleting, setDeleting] = useState(false)

  const pct = goal.targetAmount > 0
    ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
    : 0
  const days = daysRemaining(goal.deadline)
  const isComplete = goal.currentAmount >= goal.targetAmount

  // Determine progress bar color
  const deadlinePct = (() => {
    if (!goal.deadline || !goal.createdAt) return 0
    const created = goal.createdAt.toDate()
    const deadline = parseISO(goal.deadline)
    if (!isValid(deadline)) return 0
    const total = differenceInDays(deadline, created)
    const elapsed = differenceInDays(new Date(), created)
    return total > 0 ? (elapsed / total) * 100 : 0
  })()

  const barColor =
    isComplete ? "bg-green-500" :
    deadlinePct > 70 ? "bg-amber-500" :
    "bg-primary"

  async function handleAportar() {
    const amt = parseFloat(aportarAmount)
    if (isNaN(amt) || amt <= 0) { toast.error("Importe inválido"); return }
    try {
      await updateProgress.mutateAsync({ id: goal.id, currentAmount: goal.currentAmount + amt })
      toast.success(`+${formatCurrency(amt, goal.currency)} aportado`)
      setAportarAmount("")
      setAportarOpen(false)
    } catch { toast.error("Error al aportar") }
  }

  async function handleComplete() {
    try {
      await updateGoal.mutateAsync({ id: goal.id, isActive: false })
      toast.success("Meta marcada como completada")
    } catch { toast.error("Error al completar") }
  }

  async function handleDelete() {
    if (!deleting) { setDeleting(true); return }
    try {
      await deleteGoal.mutateAsync(goal.id)
      toast.success("Meta eliminada")
    } catch { toast.error("Error al eliminar") }
    setDeleting(false)
  }

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold truncate">{goal.name}</p>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                goal.type === "saving"
                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                  : "bg-orange-500/15 text-orange-600 dark:text-orange-400"
              )}>
                {goal.type === "saving" ? "Ahorro" : "Límite diario"}
              </span>
            </div>
            {days !== null && (
              <p className={cn(
                "text-xs mt-0.5",
                days < 0 ? "text-destructive" :
                days < 7 ? "text-amber-600 dark:text-amber-400" :
                "text-muted-foreground"
              )}>
                {days < 0
                  ? `Venció hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? "s" : ""}`
                  : days === 0 ? "Vence hoy"
                  : `${days} día${days !== 1 ? "s" : ""} restante${days !== 1 ? "s" : ""}`}
                {goal.deadline && ` · ${format(parseISO(goal.deadline), "d MMM yyyy", { locale: es })}`}
              </p>
            )}
          </div>
          <button
            onClick={handleDelete}
            className={cn(
              "shrink-0 transition-colors",
              deleting
                ? "text-destructive"
                : "text-muted-foreground hover:text-destructive"
            )}
            title={deleting ? "Clic para confirmar" : "Eliminar meta"}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Amounts */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold tabular-nums">
              {formatCurrency(goal.currentAmount, goal.currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              de {formatCurrency(goal.targetAmount, goal.currency)}
            </p>
          </div>
          <p className="text-sm font-semibold text-muted-foreground">{pct.toFixed(0)}%</p>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {!isComplete && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs flex-1"
              onClick={() => setAportarOpen(o => !o)}
            >
              {aportarOpen ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
              Aportar
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={handleComplete}
            disabled={updateGoal.isPending}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Completar
          </Button>
        </div>

        {/* Aportar inline input */}
        {aportarOpen && (
          <div className="flex gap-2 items-center pt-1">
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="0.00"
              value={aportarAmount}
              onChange={e => setAportarAmount(e.target.value)}
              className="h-8 text-sm tabular-nums flex-1"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") handleAportar() }}
            />
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleAportar}
              disabled={updateProgress.isPending}
            >
              {updateProgress.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Añadir"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GoalsClient() {
  const { data: goals = [], isLoading } = useGoals()
  const addGoal = useAddGoal()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [showCompleted, setShowCompleted] = useState(false)

  const active = goals.filter(g => g.isActive)
  const completed = goals.filter(g => !g.isActive)

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleCreate() {
    if (!form.name.trim()) { toast.error("Nombre requerido"); return }
    const target = parseFloat(form.targetAmount)
    if (isNaN(target) || target <= 0) { toast.error("Importe inválido"); return }
    try {
      await addGoal.mutateAsync({
        type: form.type,
        name: form.name.trim(),
        targetAmount: target,
        currentAmount: 0,
        currency: form.currency,
        deadline: form.deadline || null,
      })
      toast.success("Meta creada")
      setForm(emptyForm())
      setOpen(false)
    } catch { toast.error("Error al crear la meta") }
  }

  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Metas de ahorro
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controla tus objetivos financieros
          </p>
        </div>
        <Button className="gap-1.5 shrink-0" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva meta
        </Button>
      </div>

      {/* Active goals */}
      {active.length === 0 && completed.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-12 text-center space-y-3">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground opacity-30" />
          <div>
            <p className="font-semibold">Sin metas todavía</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crea tu primera meta de ahorro para empezar a controlar tus objetivos
            </p>
          </div>
          <Button onClick={() => setOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Crea tu primera meta
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map(g => <GoalCard key={g.id} goal={g} />)}
        </div>
      )}

      {/* Completed goals */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowCompleted(s => !s)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showCompleted ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Metas completadas ({completed.length})
          </button>
          {showCompleted && (
            <div className="space-y-3 opacity-70">
              {completed.map(g => <GoalCard key={g.id} goal={g} />)}
            </div>
          )}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-4 w-4" /> Nueva meta
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1 block">Tipo</Label>
              <Select value={form.type} onValueChange={v => set("type", v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="saving">Meta de ahorro</SelectItem>
                  <SelectItem value="daily_limit">Límite diario</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Nombre *</Label>
              <Input
                placeholder="Vacaciones, fondo de emergencia..."
                value={form.name}
                onChange={e => set("name", e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs mb-1 block">Importe objetivo *</Label>
                <Input
                  type="number"
                  placeholder="1000"
                  min="0"
                  step="0.01"
                  value={form.targetAmount}
                  onChange={e => set("targetAmount", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Moneda</Label>
                <Select value={form.currency} onValueChange={v => set("currency", v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1 block">
                Fecha límite <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                type="date"
                value={form.deadline}
                onChange={e => set("deadline", e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <Button className="w-full" onClick={handleCreate} disabled={addGoal.isPending}>
              {addGoal.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crear meta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
