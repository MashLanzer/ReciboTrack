"use client"

import { useEffect, useState } from "react"
import { useUpdateExpense } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { useProjects } from "@/hooks/use-projects"
import { PAYMENT_METHODS, CURRENCIES } from "@/lib/constants"
import type { Expense, ReceiptItem } from "@/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, Plus, X, ChevronDown, ChevronUp, ShoppingCart } from "lucide-react"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/utils"
import { CategorySuggestion } from "@/components/shared/category-suggestion"

interface Props {
  expense: Expense | null
  onClose: () => void
}

export function ExpenseEditDialog({ expense, onClose }: Props) {
  const { data: categories = [] } = useCategories()
  const { projectNames } = useProjects()
  const updateExpense = useUpdateExpense()

  const [form, setForm] = useState({
    merchant: "", date: "", total: "", subtotal: "", tax: "",
    category: "otros", paymentMethod: "", currency: "USD", reference: "", notes: "",
    tags: [] as string[], project: "",
  })
  const [tagInput, setTagInput] = useState("")
  const [items, setItems] = useState<ReceiptItem[]>([])
  const [itemsOpen, setItemsOpen] = useState(false)

  useEffect(() => {
    if (expense) {
      const d = expense.date.toDate()
      setForm({
        merchant: expense.merchant,
        date: format(d, "yyyy-MM-dd"),
        total: expense.total.toString(),
        subtotal: expense.subtotal.toString(),
        tax: expense.tax.toString(),
        category: expense.category,
        paymentMethod: expense.paymentMethod ?? "",
        currency: expense.currency,
        reference: expense.reference ?? "",
        notes: expense.notes,
        tags: expense.tags ?? [],
        project: expense.project ?? "",
      })
      setItems(expense.items ?? [])
      setItemsOpen((expense.items ?? []).length > 0)
    }
  }, [expense])

  function addItem() {
    setItems((prev) => [...prev, { name: "", price: 0, quantity: 1 }])
  }

  function updateItem(idx: number, field: keyof ReceiptItem, value: string | number) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (!t || form.tags.includes(t)) { setTagInput(""); return }
    setForm((f) => ({ ...f, tags: [...f.tags, t] }))
    setTagInput("")
  }

  function removeTag(tag: string) {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!expense) return
    try {
      const cleanItems = items.filter((it) => it.name.trim())
      await updateExpense.mutateAsync({
        id: expense.id,
        input: {
          merchant: form.merchant,
          date: new Date(form.date + "T12:00:00"),
          items: cleanItems,
          total: parseFloat(form.total) || 0,
          subtotal: parseFloat(form.subtotal) || 0,
          tax: parseFloat(form.tax) || 0,
          category: form.category,
          paymentMethod: form.paymentMethod || null,
          currency: form.currency,
          reference: form.reference || null,
          notes: form.notes,
          tags: form.tags,
          project: form.project || undefined,
        },
      })
      toast.success("Gasto actualizado")
      onClose()
    } catch {
      toast.error("Error al actualizar")
    }
  }

  return (
    <Dialog open={!!expense} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar gasto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Comercio</Label>
              <Input value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Total</Label>
              <Input type="number" step="0.01" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} className="tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label>Subtotal</Label>
              <Input type="number" step="0.01" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} className="tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label>Impuestos</Label>
              <Input type="number" step="0.01" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} className="tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <CategorySuggestion
                merchant={form.merchant}
                currentCategory={form.category}
                onAccept={(cat) => setForm((f) => ({ ...f, category: cat }))}
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
              <Label>Método de pago</Label>
              <Select value={form.paymentMethod || "__none__"} onValueChange={(v) => setForm({ ...form, paymentMethod: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Sin especificar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin especificar</SelectItem>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Referencia</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Nº transacción" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notas</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Cliente / Proyecto <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input
                list="project-suggestions"
                placeholder="Nombre del cliente o proyecto..."
                value={form.project}
                onChange={(e) => setForm({ ...form, project: e.target.value })}
              />
              {projectNames.length > 0 && (
                <datalist id="project-suggestions">
                  {projectNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              )}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Etiquetas</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
                  placeholder="trabajo, viaje, deducible..."
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={addTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {form.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 cursor-pointer"
                      onClick={() => removeTag(tag)}>
                      {tag} <X className="h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Line items */}
          <div className="col-span-2 space-y-1.5 border rounded-lg p-3 bg-muted/30">
            <button
              type="button"
              onClick={() => setItemsOpen((o) => !o)}
              className="flex items-center justify-between w-full text-sm font-medium"
            >
              <span className="flex items-center gap-1.5">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                Artículos
                {items.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{items.length}</Badge>
                )}
              </span>
              {itemsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {itemsOpen && (
              <div className="space-y-2 mt-2">
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Sin artículos</p>
                )}
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-1.5 items-center">
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(idx, "name", e.target.value)}
                      placeholder="Nombre"
                      className="flex-1 h-8 text-xs"
                    />
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                      className="w-14 h-8 text-xs tabular-nums text-center"
                      title="Cantidad"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => updateItem(idx, "price", parseFloat(e.target.value) || 0)}
                      className="w-20 h-8 text-xs tabular-nums"
                      title="Precio unitario"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {items.length > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
                    <span>{items.length} artículo{items.length !== 1 ? "s" : ""}</span>
                    <span className="tabular-nums font-medium">
                      {formatCurrency(items.reduce((s, it) => s + it.price * it.quantity, 0), form.currency)}
                    </span>
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" className="w-full h-7 text-xs gap-1.5" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5" />
                  Añadir artículo
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={updateExpense.isPending}>
              {updateExpense.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
