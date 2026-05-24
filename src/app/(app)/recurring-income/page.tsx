"use client"

import { useState, useMemo } from "react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Plus, Pencil, Trash2, Repeat } from "lucide-react"
import {
  useRecurringIncome,
  useAddRecurringIncome,
  useUpdateRecurringIncome,
  useDeleteRecurringIncome,
  type RecurringIncomeTemplate,
  type RecurringIncomeInput,
} from "@/hooks/use-recurring-income"
import { formatCurrency, cn } from "@/lib/utils"
import { CURRENCIES } from "@/lib/constants"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  yearly: "Anual",
}

const FREQUENCY_MULTIPLIERS: Record<string, number> = {
  weekly: 4.33,
  biweekly: 2.17,
  monthly: 1,
  yearly: 1 / 12,
}

const SOURCES = ["Nómina", "Freelance", "Inversiones", "Alquiler", "Otro"]

const SOURCE_EMOJI: Record<string, string> = {
  Nómina: "💼",
  Freelance: "💻",
  Inversiones: "📈",
  Alquiler: "🏠",
  Otro: "📦",
}

const ACCOUNT_LABELS: Record<string, string> = {
  personal: "Personal",
  business: "Negocio",
}

const emptyForm: RecurringIncomeInput = {
  description: "",
  source: "Nómina",
  amount: 0,
  currency: "USD",
  frequency: "monthly",
  nextDueDate: format(new Date(), "yyyy-MM-dd"),
  account: "personal",
  isActive: true,
}

function toMonthly(amount: number, frequency: string): number {
  return amount * (FREQUENCY_MULTIPLIERS[frequency] ?? 1)
}

export default function RecurringIncomePage() {
  const { data: templates = [], isLoading } = useRecurringIncome()
  const addMutation = useAddRecurringIncome()
  const updateMutation = useUpdateRecurringIncome()
  const deleteMutation = useDeleteRecurringIncome()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<RecurringIncomeInput>(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const active = useMemo(() => templates.filter((t) => t.isActive), [templates])

  const monthlyTotal = useMemo(
    () => active.reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0),
    [active]
  )

  const nextIncome = useMemo(() => {
    if (active.length === 0) return null
    return active.reduce((earliest, t) =>
      t.nextDueDate < earliest.nextDueDate ? t : earliest
    )
  }, [active])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(t: RecurringIncomeTemplate) {
    setEditingId(t.id)
    setForm({
      description: t.description,
      source: t.source,
      amount: t.amount,
      currency: t.currency,
      frequency: t.frequency,
      nextDueDate: t.nextDueDate,
      account: t.account,
      isActive: t.isActive,
    })
    setDialogOpen(true)
  }

  function handleField<K extends keyof RecurringIncomeInput>(
    key: K,
    value: RecurringIncomeInput[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim() || form.amount <= 0 || !form.nextDueDate) return
    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, ...form })
    } else {
      await addMutation.mutateAsync(form)
    }
    setDialogOpen(false)
  }

  function handleToggleActive(id: string, current: boolean) {
    updateMutation.mutate({ id, isActive: !current })
  }

  async function handleDelete() {
    if (!deleteId) return
    await deleteMutation.mutateAsync(deleteId)
    setDeleteId(null)
  }

  const isPending = addMutation.isPending || updateMutation.isPending

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-income/15 flex items-center justify-center shrink-0">
            <Repeat className="h-5 w-5 text-income" />
          </div>
          <div>
            <h1 className="font-bold text-xl">Ingresos Recurrentes</h1>
            <p className="text-xs text-muted-foreground">
              Gestiona tus fuentes de ingreso que se repiten regularmente
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate} className="shrink-0 gap-1.5">
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border bg-card px-3 py-3 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
              Ingreso mensual activo
            </p>
            <p className="text-sm font-bold tabular-nums text-income">
              {formatCurrency(monthlyTotal)}
            </p>
          </div>
          <div className="rounded-2xl border bg-card px-3 py-3 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
              Fuentes activas
            </p>
            <p className="text-sm font-bold tabular-nums">{active.length}</p>
          </div>
          <div className="rounded-2xl border bg-card px-3 py-3 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
              Próximo ingreso
            </p>
            {nextIncome ? (
              <p className="text-sm font-bold tabular-nums">
                {format(parseISO(nextIncome.nextDueDate), "dd MMM", { locale: es })}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>
      )}

      {/* ── Template list ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Plantillas
        </p>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center space-y-2">
            <p className="text-muted-foreground text-sm">
              Sin plantillas de ingreso recurrente.
            </p>
            <p className="text-xs text-muted-foreground">
              Añade una para registrar tus fuentes de ingreso periódicas.
            </p>
            <Button size="sm" variant="outline" onClick={openCreate} className="mt-2 gap-1.5">
              <Plus className="h-4 w-4" />
              Agregar plantilla
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => {
              const emoji = SOURCE_EMOJI[t.source] ?? SOURCE_EMOJI["Otro"]
              return (
                <div
                  key={t.id}
                  className={cn(
                    "rounded-2xl border bg-card p-4 transition-opacity",
                    !t.isActive && "opacity-50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl shrink-0 mt-0.5">{emoji}</span>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold truncate">{t.description}</p>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {FREQUENCY_LABELS[t.frequency] ?? t.frequency}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {ACCOUNT_LABELS[t.account] ?? t.account}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.source}</p>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-bold tabular-nums text-income">
                          {formatCurrency(t.amount, t.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Próximo:{" "}
                          {format(parseISO(t.nextDueDate), "dd MMM yyyy", { locale: es })}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(t.id, t.isActive)}
                      className={cn(
                        "h-5 w-9 rounded-full transition-colors shrink-0",
                        t.isActive ? "bg-income" : "bg-muted"
                      )}
                      title={t.isActive ? "Desactivar" : "Activar"}
                    >
                      <span
                        className={cn(
                          "block h-4 w-4 rounded-full bg-white shadow transition-transform mx-0.5",
                          t.isActive ? "translate-x-4" : "translate-x-0"
                        )}
                      />
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(t.id)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 12-month projection ────────────────────────────────────────── */}
      {!isLoading && active.length > 0 && (
        <div className="rounded-2xl border bg-card p-4 space-y-4">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Proyección 12 meses
          </p>
          <div className="space-y-2">
            {Array.from({ length: 12 }, (_, i) => {
              const d = new Date()
              d.setMonth(d.getMonth() + i)
              const label = format(d, "MMM yyyy", { locale: es })
              const total = active.reduce(
                (sum, t) => sum + toMonthly(t.amount, t.frequency),
                0
              )
              const max = monthlyTotal > 0 ? monthlyTotal : 1
              const pct = Math.min((total / max) * 100, 100)
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16 shrink-0 capitalize">
                    {label}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-income"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold tabular-nums w-24 text-right shrink-0 text-income">
                    {formatCurrency(total)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Create/Edit dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar plantilla" : "Nueva plantilla"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                placeholder="Ej. Salario mensual"
                value={form.description}
                onChange={(e) => handleField("description", e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="source">Fuente</Label>
              <Select
                value={form.source}
                onValueChange={(v) => handleField("source", v)}
              >
                <SelectTrigger id="source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SOURCE_EMOJI[s]} {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Monto</Label>
                <Input
                  id="amount"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount || ""}
                  onChange={(e) =>
                    handleField("amount", parseFloat(e.target.value) || 0)
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currency">Moneda</Label>
                <Select
                  value={form.currency}
                  onValueChange={(v) => handleField("currency", v)}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="frequency">Frecuencia</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) =>
                  handleField(
                    "frequency",
                    v as RecurringIncomeInput["frequency"]
                  )
                }
              >
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quincenal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="account">Cuenta</Label>
              <Select
                value={form.account}
                onValueChange={(v) =>
                  handleField(
                    "account",
                    v as RecurringIncomeInput["account"]
                  )
                }
              >
                <SelectTrigger id="account">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="business">Negocio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nextDueDate">Próxima fecha</Label>
              <Input
                id="nextDueDate"
                type="date"
                value={form.nextDueDate}
                onChange={(e) => handleField("nextDueDate", e.target.value)}
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={form.isActive}
                onClick={() => handleField("isActive", !form.isActive)}
                className={cn(
                  "h-5 w-9 rounded-full transition-colors shrink-0",
                  form.isActive ? "bg-income" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "block h-4 w-4 rounded-full bg-white shadow transition-transform mx-0.5",
                    form.isActive ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
              <Label className="cursor-pointer" onClick={() => handleField("isActive", !form.isActive)}>
                {form.isActive ? "Activo" : "Inactivo"}
              </Label>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                disabled={isPending}
                className="flex-1"
              >
                {isPending ? "Guardando…" : editingId ? "Guardar cambios" : "Crear plantilla"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ─────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null) }}
        title="Eliminar plantilla"
        description="¿Estás seguro de que quieres eliminar esta plantilla de ingreso recurrente? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}
