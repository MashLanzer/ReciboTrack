"use client"

import { useState, useMemo } from "react"
import {
  useTravelBudgets,
  useAddTravelBudget,
  useUpdateTravelBudget,
  useDeleteTravelBudget,
} from "@/hooks/use-travel-budgets"
import { useExpenses } from "@/hooks/use-expenses"
import type { TravelBudget } from "@/types"
import { formatCurrency, toDate, cn } from "@/lib/utils"
import { CURRENCIES } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  Plus,
  Trash2,
  Plane,
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
} from "lucide-react"
import { format, differenceInDays, isWithinInterval } from "date-fns"
import { es } from "date-fns/locale"

const TRAVEL_EMOJIS = ["✈️", "🏖️", "🏔️", "🎡", "🎭", "🏕️", "🚢", "🗺️", "🎒", "💼", "🏨", "🎪"]

function emptyForm() {
  const today = new Date().toISOString().split("T")[0]
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  return {
    name: "",
    emoji: "✈️",
    totalLimit: "",
    currency: "USD",
    startDate: today,
    endDate: nextWeek,
    tags: "",
  }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ start, end }: { start: Date; end: Date }) {
  const now = new Date()
  const isActive = now >= start && now <= end
  const isFuture = now < start
  if (isActive) return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 font-medium">
      En curso
    </span>
  )
  if (isFuture) return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium">
      Próximo
    </span>
  )
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
      Finalizado
    </span>
  )
}

// ─── Trip Card ────────────────────────────────────────────────────────────────

function TripCard({ budget, onDelete }: { budget: TravelBudget; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    name: budget.name,
    emoji: budget.emoji,
    totalLimit: String(budget.totalLimit),
    currency: budget.currency,
    startDate: budget.startDate.toDate().toISOString().split("T")[0],
    endDate: budget.endDate.toDate().toISOString().split("T")[0],
    tags: budget.tags.join(", "),
  })
  const update = useUpdateTravelBudget()

  const startDate = toDate(budget.startDate)
  const endDate = toDate(budget.endDate)
  const now = new Date()

  const { data: result } = useExpenses({ startDate, endDate })
  const allExpenses = result?.expenses ?? []

  const spent = useMemo(() => {
    let total = 0
    for (const e of allExpenses) {
      if (budget.tags.length > 0) {
        if (!budget.tags.some(t => e.tags?.includes(t))) continue
      }
      total += e.total
    }
    return total
  }, [allExpenses, budget.tags])

  const pct = Math.min((spent / budget.totalLimit) * 100, 100)
  const remaining = budget.totalLimit - spent
  const isOver = now > endDate

  // Category breakdown
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of allExpenses) {
      if (budget.tags.length > 0 && !budget.tags.some(t => e.tags?.includes(t))) continue
      map[e.category] = (map[e.category] ?? 0) + e.total
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [allExpenses, budget.tags])

  // Top merchants
  const topMerchants = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of allExpenses) {
      if (budget.tags.length > 0 && !budget.tags.some(t => e.tags?.includes(t))) continue
      map[e.merchant] = (map[e.merchant] ?? 0) + e.total
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 3)
  }, [allExpenses, budget.tags])

  const barColor =
    pct >= 100 ? "bg-destructive" :
    pct >= 80 ? "bg-amber-500" :
    "bg-primary"

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    onDelete()
  }

  async function handleSaveEdit() {
    const limit = parseFloat(editForm.totalLimit)
    if (!editForm.name.trim() || isNaN(limit) || limit <= 0) {
      toast.error("Revisa nombre y presupuesto")
      return
    }
    try {
      await update.mutateAsync({
        id: budget.id,
        updates: {
          name:       editForm.name.trim(),
          emoji:      editForm.emoji,
          totalLimit: limit,
          currency:   editForm.currency,
          startDate:  new Date(editForm.startDate),
          endDate:    new Date(editForm.endDate),
          tags:       editForm.tags ? editForm.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        },
      })
      toast.success("Viaje actualizado")
      setEditOpen(false)
    } catch {
      toast.error("Error al guardar")
    }
  }

  return (
    <div className={cn("rounded-2xl border bg-card overflow-hidden", isOver && "opacity-80")}>
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-2">
        <span className="text-3xl shrink-0 mt-0.5">{budget.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold truncate">{budget.name}</p>
            <StatusBadge start={startDate} end={endDate} />
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Calendar className="h-3 w-3 shrink-0" />
            {format(startDate, "d MMM", { locale: es })} – {format(endDate, "d MMM yyyy", { locale: es })}
            {!isOver && (
              <>
                <span className="mx-1">·</span>
                {Math.max(differenceInDays(endDate, now), 0)}d restantes
              </>
            )}
          </p>
          {budget.tags.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Tags: {budget.tags.map(t => `#${t}`).join(" ")}
            </p>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 pb-3 space-y-2">
        <div className="flex items-end justify-between">
          <p className="text-2xl font-bold tabular-nums">
            {formatCurrency(spent, budget.currency)}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            de {formatCurrency(budget.totalLimit, budget.currency)}
          </p>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{pct.toFixed(0)}% usado</span>
          <span className={cn(remaining < 0 ? "text-destructive font-medium" : "")}>
            {remaining >= 0
              ? `${formatCurrency(remaining, budget.currency)} disponible`
              : `${formatCurrency(Math.abs(remaining), budget.currency)} excedido`}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs flex-1 gap-1"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Ver detalle
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 text-xs gap-1",
            confirmDelete ? "text-destructive border-destructive" : "text-muted-foreground hover:text-destructive"
          )}
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {confirmDelete ? "Confirmar" : "Eliminar"}
        </Button>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar viaje</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {/* Emoji + name */}
            <div className="flex gap-2">
              <Select value={editForm.emoji} onValueChange={(v) => setEditForm(f => ({ ...f, emoji: v }))}>
                <SelectTrigger className="w-16 shrink-0 text-xl px-2">
                  <SelectValue>{editForm.emoji}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TRAVEL_EMOJIS.map(e => (
                    <SelectItem key={e} value={e}><span className="text-xl">{e}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Nombre del viaje"
                value={editForm.name}
                onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="flex-1"
              />
            </div>
            {/* Budget + currency */}
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Presupuesto"
                value={editForm.totalLimit}
                onChange={(e) => setEditForm(f => ({ ...f, totalLimit: e.target.value }))}
                className="flex-1"
              />
              <Select value={editForm.currency} onValueChange={(v) => setEditForm(f => ({ ...f, currency: v }))}>
                <SelectTrigger className="w-24 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Dates */}
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Inicio</Label>
                <Input
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) => setEditForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Fin</Label>
                <Input
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm(f => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            {/* Tags */}
            <div className="space-y-1">
              <Label className="text-xs">Etiquetas (separadas por coma)</Label>
              <Input
                placeholder="vacaciones, playa, familia"
                value={editForm.tags}
                onChange={(e) => setEditForm(f => ({ ...f, tags: e.target.value }))}
              />
            </div>
            <Button
              className="w-full gap-2"
              onClick={handleSaveEdit}
              disabled={update.isPending}
            >
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t space-y-4">
          <p className="text-xs text-muted-foreground">{allExpenses.length} gastos en el período</p>

          {byCategory.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium">Por categoría</p>
              {byCategory.map(([cat, total]) => (
                <div key={cat} className="flex items-center justify-between text-xs">
                  <span className="capitalize text-muted-foreground">{cat}</span>
                  <span className="tabular-nums font-medium">{formatCurrency(total, budget.currency)}</span>
                </div>
              ))}
            </div>
          )}

          {topMerchants.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium">Top comercios</p>
              {topMerchants.map(([merchant, total]) => (
                <div key={merchant} className="flex items-center justify-between text-xs">
                  <span className="truncate text-muted-foreground">{merchant}</span>
                  <span className="tabular-nums font-medium ml-2 shrink-0">{formatCurrency(total, budget.currency)}</span>
                </div>
              ))}
            </div>
          )}

          {allExpenses.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              No hay gastos registrados en este período
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TripsClient() {
  const { data: budgets = [], isLoading } = useTravelBudgets()
  const add = useAddTravelBudget()
  const remove = useDeleteTravelBudget()

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())

  const now = new Date()
  const active = budgets.filter(b => toDate(b.endDate) >= now)
  const past = budgets.filter(b => toDate(b.endDate) < now)
  const [showPast, setShowPast] = useState(false)

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleCreate() {
    if (!form.name.trim() || !form.totalLimit) { toast.error("Rellena nombre y presupuesto"); return }
    const limit = parseFloat(form.totalLimit)
    if (isNaN(limit) || limit <= 0) { toast.error("Presupuesto inválido"); return }
    if (!form.startDate || !form.endDate) { toast.error("Selecciona fechas"); return }
    try {
      await add.mutateAsync({
        name: form.name.trim(),
        emoji: form.emoji,
        totalLimit: limit,
        currency: form.currency,
        startDate: new Date(form.startDate),
        endDate: new Date(form.endDate),
        tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      })
      toast.success("Viaje creado")
      setForm(emptyForm())
      setOpen(false)
    } catch { toast.error("Error al crear el viaje") }
  }

  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-2xl" />
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
            <Plane className="h-6 w-6 text-primary" />
            Mis Viajes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controla el presupuesto de cada aventura
          </p>
        </div>
        <Button className="gap-1.5 shrink-0" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo viaje
        </Button>
      </div>

      {/* Empty state */}
      {budgets.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-12 text-center space-y-3">
          <span className="text-5xl">✈️</span>
          <div>
            <p className="font-semibold">No tienes viajes aún</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crea tu primer viaje para controlar el gasto
            </p>
          </div>
          <Button onClick={() => setOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Crea tu primer viaje
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {active.map(b => (
            <TripCard key={b.id} budget={b} onDelete={() => remove.mutate(b.id)} />
          ))}

          {past.length > 0 && (
            <div className="space-y-4">
              <button
                onClick={() => setShowPast(s => !s)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPast ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Viajes finalizados ({past.length})
              </button>
              {showPast && (
                <div className="space-y-4">
                  {past.map(b => (
                    <TripCard key={b.id} budget={b} onDelete={() => remove.mutate(b.id)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="h-4 w-4" /> Nuevo viaje
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Emoji picker */}
            <div>
              <Label className="text-xs mb-1.5 block">Icono</Label>
              <div className="flex flex-wrap gap-1.5">
                {TRAVEL_EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => set("emoji", e)}
                    className={cn(
                      "h-8 w-8 rounded-lg text-lg flex items-center justify-center transition-colors",
                      form.emoji === e
                        ? "bg-primary/20 ring-2 ring-primary"
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Nombre *</Label>
              <Input
                placeholder="Vacaciones Roma, Boda de Ana..."
                value={form.name}
                onChange={e => set("name", e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs mb-1 block">Presupuesto total *</Label>
                <Input
                  type="number"
                  placeholder="800"
                  min="0"
                  step="0.01"
                  value={form.totalLimit}
                  onChange={e => set("totalLimit", e.target.value)}
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs mb-1 block">Desde</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={e => set("startDate", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Hasta</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={e => set("endDate", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1 block">
                Tags <span className="text-muted-foreground">(opcional, separados por coma)</span>
              </Label>
              <Input
                placeholder="roma, vacaciones2026"
                value={form.tags}
                onChange={e => set("tags", e.target.value)}
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Solo contarán gastos con estas etiquetas. Deja vacío para todos los gastos del período.
              </p>
            </div>

            <Button className="w-full" onClick={handleCreate} disabled={add.isPending}>
              {add.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crear viaje
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
