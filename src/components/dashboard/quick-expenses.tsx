"use client"

import { useState, useRef } from "react"
import {
  useQuickExpenses,
  useAddQuickExpense,
  useDeleteQuickExpense,
} from "@/hooks/use-quick-expenses"
import { useAddExpense } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { useAuth } from "@/hooks/use-auth"
import { DEFAULT_CATEGORIES, CURRENCIES, PAYMENT_METHODS } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import type { QuickExpense } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Plus, Settings2, Trash2, Zap, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Emoji picker (simple grid) ─────────────────────────────────────────────

const QUICK_EMOJIS = [
  "☕","🍔","🍕","🛒","⛽","🚗","🚌","✈️","🎬","🎮","💊","🏋️","🏠",
  "💡","📱","👕","💈","🐾","🎓","💳","🍺","🥤","🍜","🛵","🚲",
]

// ─── Default form state ──────────────────────────────────────────────────────

function emptyForm() {
  return {
    label: "",
    merchant: "",
    amount: "",
    category: "comida",
    currency: "USD",
    paymentMethod: "",
    tags: "",
    icon: "☕",
  }
}

// ─── Quick chip (single card) ────────────────────────────────────────────────

function QuickChip({
  item,
  onTap,
  onDelete,
  loading,
}: {
  item: QuickExpense
  onTap: () => void
  onDelete: () => void
  loading: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="relative group shrink-0">
      <button
        onClick={onTap}
        disabled={loading}
        className={cn(
          "flex flex-col items-center gap-1.5 w-20 py-3 px-2 rounded-2xl border bg-card",
          "hover:border-primary/50 hover:bg-primary/5 active:scale-95",
          "transition-all duration-150 text-center",
          loading && "opacity-60 cursor-not-allowed"
        )}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <span className="text-2xl leading-none">{item.icon}</span>
        )}
        <span className="text-[10px] font-medium leading-tight truncate w-full text-center">
          {item.label}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">
          {formatCurrency(item.amount, item.currency)}
        </span>
      </button>

      {/* Delete X — shown on hover */}
      {!loading && (
        confirmDelete ? (
          <div className="absolute -top-1 -right-1 flex gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px] font-bold shadow"
            >
              ✓
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }}
              className="h-5 w-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center shadow"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
            className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-muted text-muted-foreground
              flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )
      )}
    </div>
  )
}

// ─── Create / manage dialog ──────────────────────────────────────────────────

function ManageDialog({
  open,
  onClose,
  quickExpenses,
}: {
  open: boolean
  onClose: () => void
  quickExpenses: QuickExpense[]
}) {
  const { data: categories = [] } = useCategories()
  const allCats = categories.length > 0 ? categories : DEFAULT_CATEGORIES
  const addQuick = useAddQuickExpense()
  const deleteQuick = useDeleteQuickExpense()

  const [form, setForm] = useState(emptyForm())
  const [tab, setTab] = useState<"list" | "new">("list")

  function setField(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleCreate() {
    if (!form.label.trim() || !form.merchant.trim() || !form.amount) {
      toast.error("Rellena nombre, comerciante e importe")
      return
    }
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error("Importe inválido")
      return
    }
    await addQuick.mutateAsync({
      label: form.label.trim(),
      merchant: form.merchant.trim(),
      amount,
      category: form.category,
      currency: form.currency,
      paymentMethod: form.paymentMethod || null,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      icon: form.icon,
      order: quickExpenses.length,
    })
    toast.success("Acceso rápido creado")
    setForm(emptyForm())
    setTab("list")
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Gastos rápidos
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 p-0.5 rounded-lg bg-muted">
          <button
            onClick={() => setTab("list")}
            className={cn(
              "flex-1 py-1.5 rounded-md text-xs font-medium transition-colors",
              tab === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            )}
          >
            Mis accesos ({quickExpenses.length})
          </button>
          <button
            onClick={() => setTab("new")}
            className={cn(
              "flex-1 py-1.5 rounded-md text-xs font-medium transition-colors",
              tab === "new" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            )}
          >
            + Nuevo
          </button>
        </div>

        {tab === "list" && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {quickExpenses.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aún no tienes accesos rápidos. ¡Crea el primero!
              </p>
            )}
            {quickExpenses.map((q) => (
              <div
                key={q.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-card"
              >
                <span className="text-xl shrink-0">{q.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{q.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(q.amount, q.currency)} · {allCats.find(c => c.id === q.category)?.name ?? q.category}
                  </p>
                </div>
                <button
                  onClick={() => deleteQuick.mutate(q.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "new" && (
          <div className="space-y-3">
            {/* Emoji picker */}
            <div>
              <Label className="text-xs mb-1.5 block">Icono</Label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setField("icon", e)}
                    className={cn(
                      "h-8 w-8 rounded-lg text-lg flex items-center justify-center transition-colors",
                      form.icon === e ? "bg-primary/20 ring-2 ring-primary" : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs mb-1 block">Nombre visible *</Label>
                <Input
                  placeholder="Café del trabajo"
                  value={form.label}
                  onChange={(e) => setField("label", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Comerciante *</Label>
                <Input
                  placeholder="Starbucks"
                  value={form.merchant}
                  onChange={(e) => setField("merchant", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs mb-1 block">Importe *</Label>
                <Input
                  type="number"
                  placeholder="4.50"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setField("amount", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Moneda</Label>
                <Select value={form.currency} onValueChange={(v) => setField("currency", v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Categoría</Label>
              <Select value={form.category} onValueChange={(v) => setField("category", v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allCats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Método de pago</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setField("paymentMethod", v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin especificar</SelectItem>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Tags (separados por coma)</Label>
              <Input
                placeholder="trabajo, diario"
                value={form.tags}
                onChange={(e) => setField("tags", e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleCreate}
              disabled={addQuick.isPending}
            >
              {addQuick.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear acceso rápido
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuickExpenses() {
  const { data: quickExpenses = [] } = useQuickExpenses()
  const deleteQuick = useDeleteQuickExpense()
  const addExpense = useAddExpense()
  const [manageOpen, setManageOpen] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleTap(q: QuickExpense) {
    if (loadingId) return
    setLoadingId(q.id)
    try {
      await addExpense.mutateAsync({
        merchant: q.merchant,
        date: new Date(),
        items: [],
        subtotal: q.amount,
        tax: 0,
        total: q.amount,
        paymentMethod: q.paymentMethod,
        reference: null,
        category: q.category,
        currency: q.currency,
        notes: "",
        tags: q.tags,
        receiptImageUrl: null,
      })

      toast.success(`${q.icon} ${q.label} añadido`, {
        description: formatCurrency(q.amount, q.currency),
        duration: 4000,
      })
    } catch {
      toast.error("Error al añadir el gasto")
    } finally {
      setLoadingId(null)
    }
  }

  // Always render the section (even empty) so users can create their first quick expense
  return (
    <section className="mb-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Accesos rápidos
          </span>
        </div>
        <button
          onClick={() => setManageOpen(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings2 className="h-3 w-3" />
          Gestionar
        </button>
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
        {quickExpenses.map((q) => (
          <QuickChip
            key={q.id}
            item={q}
            onTap={() => handleTap(q)}
            onDelete={() => deleteQuick.mutate(q.id)}
            loading={loadingId === q.id}
          />
        ))}

        {/* Add new button */}
        <button
          onClick={() => setManageOpen(true)}
          className={cn(
            "shrink-0 flex flex-col items-center justify-center gap-1 w-20 py-3 rounded-2xl",
            "border-2 border-dashed border-border text-muted-foreground",
            "hover:border-primary/50 hover:text-primary transition-colors"
          )}
        >
          <Plus className="h-5 w-5" />
          <span className="text-[10px] font-medium">Nuevo</span>
        </button>
      </div>

      <ManageDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        quickExpenses={quickExpenses}
      />
    </section>
  )
}
