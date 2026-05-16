"use client"

import { useState, useMemo } from "react"
import { useTravelBudgets, useAddTravelBudget, useDeleteTravelBudget } from "@/hooks/use-travel-budgets"
import { useExpenses } from "@/hooks/use-expenses"
import { formatCurrency, toDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { TravelBudget } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
  Plus, Trash2, MapPin, Calendar, ChevronDown, ChevronUp, Loader2,
} from "lucide-react"
import { format, differenceInDays, isWithinInterval } from "date-fns"
import { es } from "date-fns/locale"
import { CURRENCIES } from "@/lib/constants"

const TRAVEL_EMOJIS = ["✈️","🏖️","🏔️","🎡","🎭","🏕️","🚢","🗺️","🎒","💼","🏨","🎪"]

function emptyForm() {
  const today = new Date().toISOString().split("T")[0]
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  return { name: "", emoji: "✈️", totalLimit: "", currency: "USD", startDate: today, endDate: nextWeek, tags: "" }
}

// ─── Single travel budget card ────────────────────────────────────────────────

function TravelCard({ budget, onDelete }: { budget: TravelBudget; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)

  const startDate = toDate(budget.startDate)
  const endDate   = toDate(budget.endDate)
  const now       = new Date()

  const { data: result } = useExpenses({ startDate, endDate })
  const allExpenses = result?.expenses ?? []

  const spent = useMemo(() => {
    let total = 0
    for (const e of allExpenses) {
      // If tags are specified, only count expenses that have at least one matching tag
      if (budget.tags.length > 0) {
        if (!budget.tags.some(t => e.tags?.includes(t))) continue
      }
      total += e.currency === budget.currency ? e.total : e.total // simplified; real app would convert
    }
    return total
  }, [allExpenses, budget])

  const pct     = Math.min((spent / budget.totalLimit) * 100, 100)
  const remaining = budget.totalLimit - spent
  const totalDays = differenceInDays(endDate, startDate) + 1
  const daysLeft  = Math.max(differenceInDays(endDate, now), 0)
  const isActive  = now >= startDate && now <= endDate
  const isOver    = now > endDate

  const barColor =
    pct >= 100 ? "bg-destructive" :
    pct >= 80  ? "bg-amber-500" :
                 "bg-primary"

  return (
    <div className={cn(
      "rounded-2xl border bg-card overflow-hidden",
      isOver && "opacity-70"
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-2xl shrink-0">{budget.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{budget.name}</p>
            {isActive && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 font-medium">
                Activo
              </span>
            )}
            {isOver && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                Terminado
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Calendar className="h-3 w-3" />
            {format(startDate, "d MMM", { locale: es })} – {format(endDate, "d MMM yyyy", { locale: es })}
            <span className="mx-1">·</span>
            {isOver ? `${totalDays}d` : `${daysLeft}d restantes`}
          </p>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Progress */}
      <div className="px-4 pb-3 space-y-2">
        <div className="flex items-end justify-between">
          <p className="text-xl font-bold tabular-nums">
            {formatCurrency(spent, budget.currency)}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            de {formatCurrency(budget.totalLimit, budget.currency)}
          </p>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
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

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t space-y-2">
          {budget.tags.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Tags: {budget.tags.map(t => `#${t}`).join(", ")}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {allExpenses.length} gastos en el período
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive gap-1.5"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
            Eliminar presupuesto
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TravelBudgets() {
  const { data: budgets = [], isLoading } = useTravelBudgets()
  const add    = useAddTravelBudget()
  const remove = useDeleteTravelBudget()
  const [open, setOpen]         = useState(false)
  const [form, setForm]         = useState(emptyForm())
  const [showAll, setShowAll]   = useState(false)

  const now = new Date()
  const active   = budgets.filter(b => toDate(b.endDate) >= now)
  const archived = budgets.filter(b => toDate(b.endDate) < now)
  const visible  = showAll ? budgets : active

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleCreate() {
    if (!form.name.trim() || !form.totalLimit) { toast.error("Rellena nombre e importe"); return }
    const limit = parseFloat(form.totalLimit)
    if (isNaN(limit) || limit <= 0) { toast.error("Importe inválido"); return }
    try {
      await add.mutateAsync({
        name: form.name.trim(),
        emoji: form.emoji,
        totalLimit: limit,
        currency: form.currency,
        startDate: new Date(form.startDate),
        endDate:   new Date(form.endDate),
        tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      })
      toast.success("Presupuesto de viaje creado")
      setForm(emptyForm())
      setOpen(false)
    } catch { toast.error("Error al crear") }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Presupuestos de viaje</h2>
        </div>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Nuevo
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border bg-card h-20 animate-pulse" />
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-6 text-center">
          <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">Sin presupuestos de viaje activos</p>
          <Button size="sm" className="mt-3 gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Crear presupuesto de viaje
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map(b => (
            <TravelCard key={b.id} budget={b} onDelete={() => remove.mutate(b.id)} />
          ))}
          {archived.length > 0 && (
            <button
              onClick={() => setShowAll(s => !s)}
              className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1 transition-colors"
            >
              {showAll ? "Ocultar terminados" : `Ver ${archived.length} terminado${archived.length !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Nuevo presupuesto de viaje
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Emoji row */}
            <div>
              <Label className="text-xs mb-1.5 block">Icono</Label>
              <div className="flex flex-wrap gap-1.5">
                {TRAVEL_EMOJIS.map(e => (
                  <button key={e} onClick={() => set("emoji", e)}
                    className={cn("h-8 w-8 rounded-lg text-lg flex items-center justify-center transition-colors",
                      form.emoji === e ? "bg-primary/20 ring-2 ring-primary" : "bg-muted hover:bg-muted/80"
                    )}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Nombre *</Label>
              <Input placeholder="Vacaciones Roma, Boda de Ana…" value={form.name}
                onChange={e => set("name", e.target.value)} className="h-8 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs mb-1 block">Presupuesto total *</Label>
                <Input type="number" placeholder="800" min="0" step="0.01"
                  value={form.totalLimit} onChange={e => set("totalLimit", e.target.value)}
                  className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Moneda</Label>
                <Select value={form.currency} onValueChange={v => set("currency", v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs mb-1 block">Desde</Label>
                <Input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)}
                  className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Hasta</Label>
                <Input type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)}
                  className="h-8 text-sm" />
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1 block">
                Tags para filtrar gastos <span className="text-muted-foreground">(opcional, separados por coma)</span>
              </Label>
              <Input placeholder="roma, vacaciones2026" value={form.tags}
                onChange={e => set("tags", e.target.value)} className="h-8 text-sm" />
              <p className="text-[10px] text-muted-foreground mt-1">
                Si dejas vacío, se contabilizan todos los gastos del período
              </p>
            </div>

            <Button className="w-full" onClick={handleCreate} disabled={add.isPending}>
              {add.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crear presupuesto
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
