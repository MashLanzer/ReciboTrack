"use client"

import { useState } from "react"
import {
  useQuickExpenses,
  useAddQuickExpense,
  useUpdateQuickExpense,
  useDeleteQuickExpense,
} from "@/hooks/use-quick-expenses"
import { useCategories } from "@/hooks/use-categories"
import { DEFAULT_CATEGORIES, CURRENCIES, PAYMENT_METHODS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, Zap, Loader2 } from "lucide-react"
import type { QuickExpense, QuickExpenseInput } from "@/types"

interface QuickForm {
  icon: string
  label: string
  merchant: string
  amount: string
  category: string
  currency: string
  paymentMethod: string
  tags: string
  order: string
}

const EMPTY_FORM: QuickForm = {
  icon: "⚡",
  label: "",
  merchant: "",
  amount: "",
  category: "otros",
  currency: "USD",
  paymentMethod: "",
  tags: "",
  order: "0",
}

export default function QuickAccessPage() {
  const { data: quickExpenses = [], isLoading } = useQuickExpenses()
  const { data: categories = [] } = useCategories()
  const addQuick = useAddQuickExpense()
  const updateQuick = useUpdateQuickExpense()
  const deleteQuick = useDeleteQuickExpense()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<QuickForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<QuickExpense | null>(null)

  const allCategories = categories.length > 0 ? categories : DEFAULT_CATEGORIES

  function openCreate() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, order: String(quickExpenses.length) })
    setDialogOpen(true)
  }

  function openEdit(q: QuickExpense) {
    setEditingId(q.id)
    setForm({
      icon: q.icon,
      label: q.label,
      merchant: q.merchant,
      amount: q.amount.toString(),
      category: q.category,
      currency: q.currency,
      paymentMethod: q.paymentMethod ?? "",
      tags: q.tags.join(", "),
      order: q.order.toString(),
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.label.trim()) { toast.error("El nombre es obligatorio"); return }
    if (!form.merchant.trim()) { toast.error("El comercio es obligatorio"); return }
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) { toast.error("El monto debe ser mayor que 0"); return }

    setSaving(true)
    try {
      const input: QuickExpenseInput = {
        icon: form.icon.trim() || "⚡",
        label: form.label.trim(),
        merchant: form.merchant.trim(),
        amount,
        category: form.category,
        currency: form.currency,
        paymentMethod: form.paymentMethod || null,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        order: parseInt(form.order) || 0,
      }

      if (editingId) {
        await updateQuick.mutateAsync({ id: editingId, input })
        toast.success("Acceso rápido actualizado")
      } else {
        await addQuick.mutateAsync(input)
        toast.success("Acceso rápido creado")
      }
      setDialogOpen(false)
      // #26 — Resetear el formulario después de guardar para que no persistan datos
      setForm(EMPTY_FORM)
    } catch {
      toast.error("Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  function handleDelete(q: QuickExpense) {
    setDeleteTarget(q)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteQuick.mutateAsync(deleteTarget.id)
      toast.success("Eliminado")
    } catch {
      toast.error("Error al eliminar")
    }
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title={`¿Eliminar "${deleteTarget?.label}"?`}
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl">Accesos rápidos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gastos de un toque</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo acceso rápido
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && quickExpenses.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Zap className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Sin accesos rápidos</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crea atajos para tus gastos frecuentes y regístralos con un toque.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Crear el primero
          </Button>
        </div>
      )}

      {/* Cards list */}
      {!isLoading && quickExpenses.length > 0 && (
        <div className="space-y-3">
          {quickExpenses.map((q) => {
            const cat = allCategories.find((c) => c.id === q.category)
            return (
              <div
                key={q.id}
                className="rounded-2xl border bg-card p-4 flex items-center gap-4"
              >
                {/* Icon */}
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-2xl shrink-0">
                  {q.icon}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{q.label}</p>
                  <p className="text-sm text-muted-foreground truncate">{q.merchant}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-medium tabular-nums">
                      {formatCurrency(q.amount, q.currency)}
                    </span>
                    {cat && (
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {cat.icon} {cat.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => openEdit(q)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(q)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar acceso rápido" : "Nuevo acceso rápido"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-[72px_1fr] gap-3">
              <div className="space-y-1.5">
                <Label>Icono</Label>
                <Input
                  placeholder="⚡"
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  className="text-center text-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nombre *</Label>
                <Input
                  placeholder="Café, Taxi, Almuerzo..."
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Comercio *</Label>
              <Input
                placeholder="Starbucks, Uber..."
                value={form.merchant}
                onChange={(e) => setForm({ ...form, merchant: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monto *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Label>Método de pago</Label>
                <Select
                  value={form.paymentMethod || "__none__"}
                  onValueChange={(v) => setForm({ ...form, paymentMethod: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin especificar</SelectItem>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Etiquetas (separadas por comas)</Label>
              <Input
                placeholder="trabajo, diario, recurrente..."
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Orden <span className="text-muted-foreground font-normal text-[11px]">(0 = primero en la lista)</span></Label>
              <Input
                type="number"
                min="0"
                value={form.order}
                onChange={(e) => setForm({ ...form, order: e.target.value })}
                className="tabular-nums"
              />
            </div>

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? "Guardar cambios" : "Crear acceso rápido"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
