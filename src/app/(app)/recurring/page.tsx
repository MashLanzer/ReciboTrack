"use client"

import { useState, useMemo } from "react"
import {
  useRecurring,
  useAddRecurring,
  useUpdateRecurring,
  useDeleteRecurring,
  useConfirmRecurring,
  useSnoozeRecurring,
} from "@/hooks/use-recurring"
import { useAddExpense } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { useQuery } from "@tanstack/react-query"
import { collection, query as fbQuery, orderBy, limit, getDocs } from "firebase/firestore"
import { SubscriptionDetector } from "@/components/expenses/subscription-detector"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import Link from "next/link"
import {
  RefreshCw,
  Plus,
  MoreVertical,
  Clock,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  List,
  Loader2,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  History,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { addDays, addWeeks, addMonths, addYears, startOfDay, format, isSameDay, isToday, isTomorrow } from "date-fns"
import { es } from "date-fns/locale"
import { PAYMENT_METHODS, CURRENCIES, DEFAULT_CATEGORIES } from "@/lib/constants"
import type { RecurringTemplate, RecurringFrequency } from "@/types"
import { Timestamp } from "firebase/firestore"

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  yearly: "Anual",
}

// Monthly cost multipliers for summary calculation
const TO_MONTHLY: Record<RecurringFrequency, number> = {
  weekly: 4.33,
  biweekly: 2.17,
  monthly: 1,
  yearly: 1 / 12,
}

interface RecurringForm {
  merchant: string
  category: string
  total: string
  subtotal: string
  tax: string
  currency: string
  paymentMethod: string
  notes: string
  frequency: RecurringFrequency
  nextDueDate: string
}

const EMPTY_FORM: RecurringForm = {
  merchant: "",
  category: "servicios",
  total: "",
  subtotal: "",
  tax: "",
  currency: "USD",
  paymentMethod: "",
  notes: "",
  frequency: "monthly",
  nextDueDate: new Date().toISOString().split("T")[0],
}

function getDueStatus(nextDueDate: Timestamp): {
  label: string
  variant: "destructive" | "warning" | "secondary" | "outline"
  daysUntil: number
} {
  const now = new Date()
  const due = nextDueDate.toDate()
  const diff = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diff < 0) return { label: `Vencido hace ${Math.abs(diff)}d`, variant: "destructive", daysUntil: diff }
  if (diff === 0) return { label: "Vence hoy", variant: "warning", daysUntil: 0 }
  if (diff === 1) return { label: "Mañana", variant: "warning", daysUntil: 1 }
  if (diff <= 7) return { label: `En ${diff} días`, variant: "secondary", daysUntil: diff }
  return {
    label: due.toLocaleDateString("es", { day: "2-digit", month: "short" }),
    variant: "outline",
    daysUntil: diff,
  }
}

function groupByStatus(items: RecurringTemplate[]) {
  const overdue: RecurringTemplate[] = []
  const soon: RecurringTemplate[] = [] // ≤ 7 days
  const later: RecurringTemplate[] = []

  for (const item of items) {
    const { daysUntil } = getDueStatus(item.nextDueDate)
    if (daysUntil < 0) overdue.push(item)
    else if (daysUntil <= 7) soon.push(item)
    else later.push(item)
  }

  return { overdue, soon, later }
}

export default function RecurringPage() {
  const { data: templates = [], isLoading } = useRecurring()
  const { data: categories = [] } = useCategories()
  const addRecurring = useAddRecurring()
  const updateRecurring = useUpdateRecurring()
  const deleteRecurring = useDeleteRecurring()
  const confirmRecurring = useConfirmRecurring()
  const snoozeRecurring = useSnoozeRecurring()
  const addExpense = useAddExpense()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<RecurringForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [registeringId, setRegisteringId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list")

  const allCategories = categories.length > 0 ? categories : DEFAULT_CATEGORIES

  // Monthly cost estimate (all items normalized to monthly)
  const monthlyTotal = templates.reduce((sum, t) => {
    return sum + t.total * (TO_MONTHLY[t.frequency] ?? 1)
  }, 0)

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(t: RecurringTemplate) {
    setEditingId(t.id)
    setForm({
      merchant: t.merchant,
      category: t.category,
      total: t.total.toString(),
      subtotal: t.subtotal?.toString() ?? "",
      tax: t.tax?.toString() ?? "",
      currency: t.currency,
      paymentMethod: t.paymentMethod ?? "",
      notes: t.notes ?? "",
      frequency: t.frequency,
      nextDueDate: t.nextDueDate.toDate().toISOString().split("T")[0],
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.merchant.trim()) { toast.error("El comercio es obligatorio"); return }
    const total = parseFloat(form.total)
    if (!total || total <= 0) { toast.error("El total debe ser mayor que 0"); return }

    setSaving(true)
    try {
      const input = {
        merchant: form.merchant.trim(),
        category: form.category,
        total,
        subtotal: parseFloat(form.subtotal) || 0,
        tax: parseFloat(form.tax) || 0,
        currency: form.currency,
        paymentMethod: form.paymentMethod || null,
        notes: form.notes,
        tags: [],
        frequency: form.frequency,
        nextDueDate: new Date(form.nextDueDate + "T12:00:00"),
      }

      if (editingId) {
        await updateRecurring.mutateAsync({ id: editingId, input })
        toast.success("Gasto recurrente actualizado")
      } else {
        await addRecurring.mutateAsync(input)
        toast.success("Gasto recurrente creado")
      }
      setDialogOpen(false)
    } catch {
      toast.error("Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  async function handleRegister(t: RecurringTemplate) {
    setRegisteringId(t.id)
    try {
      await addExpense.mutateAsync({
        merchant: t.merchant,
        date: new Date(),
        items: [],
        subtotal: t.subtotal,
        tax: t.tax,
        total: t.total,
        paymentMethod: t.paymentMethod,
        reference: null,
        category: t.category,
        currency: t.currency,
        notes: t.notes,
        tags: t.tags,
        receiptImageUrl: null,
      })
      await confirmRecurring.mutateAsync({ id: t.id, frequency: t.frequency })
      toast.success(`"${t.merchant}" registrado como gasto`)
    } catch {
      toast.error("Error al registrar el gasto")
    } finally {
      setRegisteringId(null)
    }
  }

  async function handleSnooze(id: string) {
    try {
      await snoozeRecurring.mutateAsync(id)
      toast.info("Recordatorio pospuesto 3 días")
    } catch {
      toast.error("Error al posponer")
    }
  }

  async function handleDelete(id: string, merchant: string) {
    if (!confirm(`¿Eliminar "${merchant}" de los recurrentes?`)) return
    try {
      await deleteRecurring.mutateAsync(id)
      toast.success("Eliminado")
    } catch {
      toast.error("Error al eliminar")
    }
  }

  const { overdue, soon, later } = groupByStatus(templates)

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Recurrentes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {templates.length} activo{templates.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          {templates.length > 0 && (
            <div className="flex items-center border rounded-lg p-0.5 bg-muted/50">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setViewMode("list")}
                title="Vista de lista"
              >
                <List className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === "calendar" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setViewMode("calendar")}
                title="Vista de calendario"
              >
                <Calendar className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo
          </Button>
        </div>
      </div>

      {/* Summary card */}
      {templates.length > 0 && (
        <div className="rounded-xl border bg-card p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <TrendingDown className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Costo mensual estimado</p>
            <p className="text-2xl font-bold tabular-nums">
              ${monthlyTotal.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">sumando todos los recurrentes normalizados al mes</p>
          </div>
        </div>
      )}

      {/* Subscription detector */}
      {!isLoading && <SubscriptionDetector />}

      {/* Calendar view */}
      {!isLoading && viewMode === "calendar" && templates.length > 0 && (
        <CalendarView
          templates={templates}
          categories={allCategories}
          registeringId={registeringId}
          onRegister={handleRegister}
          onEdit={openEdit}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <RefreshCw className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Sin gastos recurrentes</p>
            <p className="text-sm text-muted-foreground mt-1">
              Registra suscripciones, renta o servicios para que te recuerden cuándo pagarlos.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Crear el primero
          </Button>
        </div>
      )}

      {/* #20 — All clear banner */}
      {!isLoading && viewMode === "list" && templates.length > 0 && overdue.length === 0 && soon.length === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-400">Todo al día</p>
            <p className="text-xs text-green-700/70 dark:text-green-500/70">
              No tienes pagos pendientes ni vencidos. ¡Buen trabajo!
            </p>
          </div>
        </div>
      )}

      {/* List sections */}
      {!isLoading && viewMode === "list" && (
        <>
          {/* Overdue section */}
          {overdue.length > 0 && (
            <Section
              title="Vencidos"
              icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
              count={overdue.length}
              accent="destructive"
            >
              {overdue.map((t) => (
                <RecurringItem
                  key={t.id}
                  template={t}
                  categories={allCategories}
                  registeringId={registeringId}
                  onRegister={handleRegister}
                  onSnooze={handleSnooze}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </Section>
          )}

          {/* Due soon section */}
          {soon.length > 0 && (
            <Section
              title="Próximos 7 días"
              icon={<Clock className="h-4 w-4 text-amber-500" />}
              count={soon.length}
            >
              {soon.map((t) => (
                <RecurringItem
                  key={t.id}
                  template={t}
                  categories={allCategories}
                  registeringId={registeringId}
                  onRegister={handleRegister}
                  onSnooze={handleSnooze}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </Section>
          )}

          {/* Later section */}
          {later.length > 0 && (
            <Section
              title="Más adelante"
              icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
              count={later.length}
            >
              {later.map((t) => (
                <RecurringItem
                  key={t.id}
                  template={t}
                  categories={allCategories}
                  registeringId={registeringId}
                  onRegister={handleRegister}
                  onSnooze={handleSnooze}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </Section>
          )}
        </>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar recurrente" : "Nuevo gasto recurrente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Comercio / Descripción *</Label>
              <Input
                placeholder="Netflix, Renta, Electricidad..."
                value={form.merchant}
                onChange={(e) => setForm({ ...form, merchant: e.target.value })}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Total *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.total}
                  onChange={(e) => setForm({ ...form, total: e.target.value })}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Subtotal</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.subtotal}
                  onChange={(e) => setForm({ ...form, subtotal: e.target.value })}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Impuestos</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.tax}
                  onChange={(e) => setForm({ ...form, tax: e.target.value })}
                  className="tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Frecuencia</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as RecurringFrequency })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Próximo vencimiento</Label>
                <Input
                  type="date"
                  value={form.nextDueDate}
                  min="2010-01-01"
                  onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Método de pago</Label>
                <Select
                  value={form.paymentMethod || "__none__"}
                  onValueChange={(v) => setForm({ ...form, paymentMethod: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin especificar</SelectItem>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input
                placeholder="Opcional..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Guardar cambios" : "Crear recurrente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Calendar helpers ────────────────────────────────────────────────────────

/** Returns all dates within [start, end] (inclusive) when this template is due */
function getOccurrencesInRange(template: RecurringTemplate, start: Date, end: Date): Date[] {
  const result: Date[] = []
  let cursor = startOfDay(template.nextDueDate.toDate())
  const s = startOfDay(start)
  const e = startOfDay(end)

  // Walk backward if nextDueDate is after start, to find the actual first occurrence
  // that could fall in range. For weekly/biweekly we may need to look back.
  // Easiest: advance from cursor forward until past end, collecting hits in range.

  // If cursor is already past end, no occurrences
  if (cursor > e) return []

  // Collect forward from cursor (which may be before start)
  let safety = 0
  while (cursor <= e && safety < 500) {
    safety++
    if (cursor >= s) {
      result.push(new Date(cursor))
    }
    // Advance by frequency
    switch (template.frequency) {
      case "weekly":   cursor = addDays(cursor, 7);   break
      case "biweekly": cursor = addDays(cursor, 14);  break
      case "monthly":  cursor = addMonths(cursor, 1); break
      case "yearly":   cursor = addYears(cursor, 1);  break
    }
  }

  return result
}

// ─── CalendarView ─────────────────────────────────────────────────────────────

function CalendarView({
  templates,
  categories,
  registeringId,
  onRegister,
  onEdit,
}: {
  templates: RecurringTemplate[]
  categories: { id: string; name: string; icon: string }[]
  registeringId: string | null
  onRegister: (t: RecurringTemplate) => void
  onEdit: (t: RecurringTemplate) => void
}) {
  const today = startOfDay(new Date())
  const end   = addDays(today, 29) // 30 days inclusive

  // Build a map: "YYYY-MM-DD" → list of templates due that day, plus derived values
  const { dayMap, sortedDays, windowTotal, daysWithPayments } = useMemo(() => {
    const map: Map<string, RecurringTemplate[]> = new Map()

    for (const t of templates) {
      const occurrences = getOccurrencesInRange(t, today, end)
      for (const date of occurrences) {
        const key = format(date, "yyyy-MM-dd")
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(t)
      }
    }

    // Sorted list of days within the window that have payments
    const days: Date[] = []
    for (let i = 0; i < 30; i++) {
      const d = addDays(today, i)
      const key = format(d, "yyyy-MM-dd")
      if (map.has(key)) days.push(d)
    }

    // Total spend across all occurrences in window
    let total = 0
    map.forEach((items) => items.forEach((t) => { total += t.total }))

    return { dayMap: map, sortedDays: days, windowTotal: total, daysWithPayments: map.size }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates])

  if (sortedDays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Calendar className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          No hay vencimientos en los próximos 30 días
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Días con pagos</p>
          <p className="text-xl font-bold tabular-nums">{daysWithPayments}</p>
          <p className="text-[10px] text-muted-foreground">en los próximos 30 días</p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Total estimado</p>
          <p className="text-xl font-bold tabular-nums">${windowTotal.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">suma de todos los vencimientos</p>
        </div>
      </div>

      {/* Day timeline */}
      <div className="space-y-3">
        {sortedDays.map((day) => {
          const key = format(day, "yyyy-MM-dd")
          const items = dayMap.get(key) ?? []
          const dayLabel = isToday(day)
            ? "Hoy"
            : isTomorrow(day)
            ? "Mañana"
            : format(day, "EEEE d 'de' MMMM", { locale: es })
          const isSoon = !isToday(day) && day <= addDays(today, 7)

          return (
            <div key={key} className="flex gap-3">
              {/* Date column */}
              <div className="w-14 shrink-0 pt-3 text-right">
                <p className={`text-xs font-bold tabular-nums leading-none ${
                  isToday(day) ? "text-primary" : "text-foreground"
                }`}>
                  {format(day, "d")}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(day, "MMM", { locale: es })}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {format(day, "EEE", { locale: es })}
                </p>
              </div>

              {/* Connector line + cards */}
              <div className="flex-1 relative">
                {/* Vertical line */}
                <div className={`absolute left-0 top-0 bottom-0 w-px -ml-px ${
                  isToday(day) ? "bg-primary" : "bg-border"
                }`} />

                {/* Dot */}
                <div className={`absolute -left-[5px] top-4 h-2.5 w-2.5 rounded-full border-2 ${
                  isToday(day)
                    ? "bg-primary border-primary"
                    : isSoon
                    ? "bg-amber-500 border-amber-500"
                    : "bg-muted border-border"
                }`} />

                <div className="pl-4 space-y-2 pb-3">
                  {/* Day label */}
                  <p className={`text-xs font-semibold capitalize pt-3 ${
                    isToday(day) ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {dayLabel}
                  </p>

                  {/* Template cards */}
                  {items.map((t) => {
                    const cat = categories.find((c) => c.id === t.category)
                    const isRegistering = registeringId === t.id
                    return (
                      <div
                        key={t.id}
                        className="rounded-xl border bg-card px-3 py-2.5 flex items-center gap-3"
                      >
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-sm shrink-0">
                          {cat?.icon ?? "📦"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{t.merchant}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(t.total, t.currency)} · {FREQUENCY_LABELS[t.frequency]}
                          </p>
                        </div>
                        {/* Quick register (only for today) */}
                        {isToday(day) && (
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 shrink-0"
                            onClick={() => onRegister(t)}
                            disabled={isRegistering}
                          >
                            {isRegistering
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <CheckCircle2 className="h-3 w-3" />
                            }
                            Pagar
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground"
                          onClick={() => onEdit(t)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center pb-2">
        Mostrando vencimientos del {format(today, "d MMM", { locale: es })} al {format(end, "d MMM yyyy", { locale: es })}
      </p>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  count,
  accent,
  children,
}: {
  title: string
  icon: React.ReactNode
  count: number
  accent?: "destructive"
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className={`text-sm font-semibold ${accent === "destructive" ? "text-destructive" : "text-muted-foreground"}`}>
          {title}
        </span>
        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
          accent === "destructive"
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground"
        }`}>
          {count}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

// ─── Hook: fetch last N payments for a merchant ──────────────────────────────
function useRecurringHistory(merchant: string, enabled: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["recurring-history", user?.uid, merchant],
    enabled: !!user && enabled,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!user) return []
      const col = collection(getFirebaseDb(), "users", user.uid, "expenses")
      // Fetch last 50 and filter client-side (case-insensitive)
      const q = fbQuery(col, orderBy("date", "desc"), limit(50))
      const snap = await getDocs(q)
      const normalized = merchant.toLowerCase()
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as { id: string; merchant: string; total: number; currency: string; date: { toDate: () => Date } }))
        .filter((e) => e.merchant.toLowerCase() === normalized)
        .slice(0, 12) // Keep last 12 payments
    },
  })
}

function RecurringItem({
  template: t,
  categories,
  registeringId,
  onRegister,
  onSnooze,
  onEdit,
  onDelete,
}: {
  template: RecurringTemplate
  categories: { id: string; name: string; icon: string }[]
  registeringId: string | null
  onRegister: (t: RecurringTemplate) => void
  onSnooze: (id: string) => void
  onEdit: (t: RecurringTemplate) => void
  onDelete: (id: string, merchant: string) => void
}) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const status = getDueStatus(t.nextDueDate)
  const cat = categories.find((c) => c.id === t.category)
  const isRegistering = registeringId === t.id

  const { data: history = [], isLoading: historyLoading } = useRecurringHistory(t.merchant, historyOpen)

  // Stats from history
  const historyTotal = history.reduce((s, e) => s + e.total, 0)
  const historyAvg = history.length > 0 ? historyTotal / history.length : 0

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Category icon */}
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-base shrink-0">
          {cat?.icon ?? "📦"}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{t.merchant}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
              {FREQUENCY_LABELS[t.frequency]}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-sm font-semibold tabular-nums">
              {t.currency} {t.total.toFixed(2)}
            </span>
            <Badge
              variant={status.variant === "warning" ? "secondary" : status.variant}
              className={`text-[10px] px-1.5 py-0 ${
                status.variant === "warning" ? "bg-amber-500/10 text-amber-600 border-amber-500/30" : ""
              }`}
            >
              {status.label}
            </Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* History toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => setHistoryOpen((o) => !o)}
            title="Ver historial"
          >
            {historyOpen ? <ChevronUp className="h-4 w-4" /> : <History className="h-4 w-4" />}
          </Button>

          <Button
            size="sm"
            className="h-8 px-2.5 text-xs gap-1"
            onClick={() => onRegister(t)}
            disabled={isRegistering}
          >
            {isRegistering
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <CheckCircle2 className="h-3 w-3" />
            }
            Registrar
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onSnooze(t.id)}>
                <Clock className="h-4 w-4" />
                Posponer 3 días
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(t)}>
                <Pencil className="h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(t.id, t.merchant)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* History panel */}
      {historyOpen && (
        <div className="border-t bg-muted/20 px-4 py-3 space-y-3">
          {historyLoading ? (
            <div className="space-y-1.5">
              {[1, 2, 3].map((i) => <div key={i} className="h-7 bg-muted/50 rounded animate-pulse" />)}
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              Sin pagos anteriores registrados
            </p>
          ) : (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-2 text-center pb-2 border-b border-border/50">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pagos</p>
                  <p className="text-sm font-bold tabular-nums">{history.length}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
                  <p className="text-sm font-bold tabular-nums">{formatCurrency(historyTotal, t.currency)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Promedio</p>
                  <p className="text-sm font-bold tabular-nums">{formatCurrency(historyAvg, t.currency)}</p>
                </div>
              </div>

              {/* Payment list */}
              <div className="space-y-1">
                {history.map((payment, idx) => {
                  const prev = history[idx + 1]
                  const delta = prev ? ((payment.total - prev.total) / prev.total) * 100 : null
                  return (
                    <div key={payment.id} className="flex items-center justify-between py-1">
                      {/* #17 — link to expense list filtered by merchant */}
                      <Link
                        href={`/expenses?q=${encodeURIComponent(t.merchant)}`}
                        className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors"
                        title="Ver en lista de gastos"
                      >
                        {payment.date.toDate().toLocaleDateString("es", { day: "2-digit", month: "short", year: "2-digit" })}
                      </Link>
                      <div className="flex items-center gap-2">
                        {delta !== null && (
                          <span className={`text-[10px] tabular-nums ${delta > 5 ? "text-destructive" : delta < -5 ? "text-green-600" : "text-muted-foreground"}`}>
                            {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
                          </span>
                        )}
                        <span className="text-xs font-medium tabular-nums">
                          {formatCurrency(payment.total, t.currency)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
