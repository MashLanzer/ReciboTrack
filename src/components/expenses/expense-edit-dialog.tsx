"use client"

import { useEffect, useState } from "react"
import { useUpdateExpense } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { PAYMENT_METHODS, CURRENCIES } from "@/lib/constants"
import type { Expense } from "@/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, Plus, X } from "lucide-react"
import { format } from "date-fns"

interface Props {
  expense: Expense | null
  onClose: () => void
}

export function ExpenseEditDialog({ expense, onClose }: Props) {
  const { data: categories = [] } = useCategories()
  const updateExpense = useUpdateExpense()

  const [form, setForm] = useState({
    merchant: "", date: "", total: "", subtotal: "", tax: "",
    category: "otros", paymentMethod: "", currency: "USD", reference: "", notes: "",
    tags: [] as string[],
  })
  const [tagInput, setTagInput] = useState("")

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
      })
    }
  }, [expense])

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
      await updateExpense.mutateAsync({
        id: expense.id,
        input: {
          merchant: form.merchant,
          date: new Date(form.date + "T12:00:00"),
          total: parseFloat(form.total) || 0,
          subtotal: parseFloat(form.subtotal) || 0,
          tax: parseFloat(form.tax) || 0,
          category: form.category,
          paymentMethod: form.paymentMethod || null,
          currency: form.currency,
          reference: form.reference || null,
          notes: form.notes,
          tags: form.tags,
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
