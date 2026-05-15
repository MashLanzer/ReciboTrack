"use client"

import { useState } from "react"
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
import { collection, query as fbQuery, where, orderBy, limit, getDocs } from "firebase/firestore"
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
  Loader2,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  History,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
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
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo
        </Button>
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
                      <span className="text-xs text-muted-foreground">
                        {payment.date.toDate().toLocaleDateString("es", { day: "2-digit", month: "short", year: "2-digit" })}
                      </span>
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
