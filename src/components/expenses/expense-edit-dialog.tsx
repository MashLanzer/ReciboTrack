"use client"

import { useEffect, useState, useMemo } from "react"
import { useUpdateExpense, useExpensesPeriod, useArchiveExpense } from "@/hooks/use-expenses"
import { QuickSplit } from "./quick-split"
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
import { Loader2, Plus, X, ChevronDown, ChevronUp, ShoppingCart, AlertTriangle, Split, Archive } from "lucide-react"
import { format, subDays, addDays, isValid, parseISO } from "date-fns"
import { formatCurrency } from "@/lib/utils"
import { CategorySuggestion } from "@/components/shared/category-suggestion"
import { CashtagInput } from "@/components/ui/cashtag-input"

interface Props {
  expense: Expense | null
  onClose: () => void
}

export function ExpenseEditDialog({ expense, onClose }: Props) {
  const { data: categories = [] } = useCategories()
  const { projectNames, expenses: allExpenses } = useProjects()
  const updateExpense = useUpdateExpense()
  const archiveExpense = useArchiveExpense()
  const [splitOpen, setSplitOpen] = useState(false)

  const [form, setForm] = useState({
    merchant: "", date: "", total: "", subtotal: "", tax: "",
    category: "otros", paymentMethod: "", currency: "USD", reference: "", notes: "",
    tags: [] as string[], project: "",
    privacy: "private" as "private" | "group" | "public",
  })
  const [tagInput, setTagInput] = useState("")
  const [items, setItems] = useState<ReceiptItem[]>([])
  const [itemsOpen, setItemsOpen] = useState(false)
  const [dupDismissed, setDupDismissed] = useState(false)

  // ── Duplicate detection ────────────────────────────────────────────────────
  const parsedDate = form.date && isValid(parseISO(form.date)) ? parseISO(form.date) : null
  const dupWindowStart = parsedDate ? subDays(parsedDate, 3) : new Date()
  const dupWindowEnd   = parsedDate ? addDays(parsedDate, 3) : new Date()
  const { data: nearbyExpenses = [] } = useExpensesPeriod(dupWindowStart, dupWindowEnd)

  const duplicates = useMemo(() => {
    if (!form.merchant || !expense || dupDismissed) return []
    const normalizedMerchant = form.merchant.trim().toLowerCase()
    const totalNum = parseFloat(form.total) || 0
    return nearbyExpenses.filter((e) =>
      e.id !== expense.id &&
      e.merchant.trim().toLowerCase() === normalizedMerchant &&
      Math.abs(e.total - totalNum) < 0.02
    )
  }, [nearbyExpenses, form.merchant, form.total, expense, dupDismissed])

  // ── All known tags + merchants (from last 6 months via useProjects pool) ──
  const { knownTags, knownMerchants } = useMemo(() => {
    const tags = new Set<string>()
    const merchants = new Set<string>()
    allExpenses.forEach((e) => {
      e.tags?.forEach((t) => tags.add(t))
      if (e.merchant) merchants.add(e.merchant)
    })
    return {
      knownTags: [...tags].sort(),
      knownMerchants: [...merchants].sort(),
    }
  }, [allExpenses])

  useEffect(() => {
    setDupDismissed(false)
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
        privacy: expense.privacy ?? "private",
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
    if (form.date) {
      const d = new Date(form.date)
      const y = d.getFullYear()
      if (isNaN(d.getTime()) || y < 2000 || y > 2030) {
        toast.error("Fecha inválida — debe estar entre 2000 y 2030")
        return
      }
    }
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
          privacy: form.privacy,
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
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">

          {/* ── Duplicate warning ── */}
          {duplicates.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl bg-warning/10 border border-warning/30 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-warning">
                  Posible duplicado — {duplicates.length} gasto{duplicates.length > 1 ? "s" : ""} similar{duplicates.length > 1 ? "es" : ""}
                </p>
                {duplicates.slice(0, 2).map((d) => (
                  <p key={d.id} className="text-xs text-warning/80 mt-0.5">
                    {d.merchant} · {formatCurrency(d.total, d.currency)} · {format(d.date.toDate(), "d MMM", { locale: undefined })}
                  </p>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setDupDismissed(true)}
                className="text-warning hover:text-warning/70 transition-colors shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* ── Section: Básico ── */}
          <div>
            <SectionDivider label="Básico" />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Comercio</Label>
                <Input
                  list="merchant-suggestions"
                  value={form.merchant}
                  onChange={(e) => setForm({ ...form, merchant: e.target.value })}
                  required
                />
                {knownMerchants.length > 0 && (
                  <datalist id="merchant-suggestions">
                    {knownMerchants.map((m) => <option key={m} value={m} />)}
                  </datalist>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={form.date}
                  min="2000-01-01"
                  max="2030-12-31"
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
                {form.date && (() => {
                  const d = new Date(form.date)
                  const y = d.getFullYear()
                  const invalid = isNaN(d.getTime()) || y < 2000 || y > 2030
                  return invalid ? (
                    <p className="text-[10px] text-destructive">Fecha inválida — debe estar entre 2000 y 2030</p>
                  ) : null
                })()}
              </div>
              {/* Total — highlighted */}
              <div className="space-y-1.5">
                <Label className="font-semibold">Total</Label>
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={form.total}
                    onChange={(e) => setForm({ ...form, total: e.target.value })}
                    className="tabular-nums font-bold text-destructive border-destructive/30 bg-destructive/5 focus:border-destructive/60 pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-destructive/60">
                    {form.currency}
                  </span>
                </div>
                {/* Running total hint when items present */}
                {items.length > 0 && (() => {
                  const itemsTotal = items.reduce((s, it) => s + it.price * it.quantity, 0)
                  const diff = Math.abs(parseFloat(form.total) - itemsTotal)
                  return diff > 0.01 ? (
                    <p className="text-[10px] text-warning font-medium">
                      Artículos suman {formatCurrency(itemsTotal, form.currency)} — diff {formatCurrency(diff, form.currency)}
                    </p>
                  ) : (
                    <p className="text-[10px] text-emerald-600 font-medium">✓ Total coincide con artículos</p>
                  )
                })()}
              </div>
              <div className="space-y-1.5">
                <Label>Subtotal</Label>
                <Input type="number" inputMode="decimal" step="0.01" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} className="tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label>Impuestos</Label>
                <Input type="number" inputMode="decimal" step="0.01" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} className="tabular-nums" />
              </div>
            </div>
          </div>

          {/* ── Section: Clasificación ── */}
          <div>
            <SectionDivider label="Clasificación" />
            <div className="grid grid-cols-2 gap-3 mt-3">
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
            </div>
          </div>

          {/* ── Section: Extras ── */}
          <div>
            <SectionDivider label="Extras" />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Notas</Label>
                <CashtagInput
                  value={form.notes}
                  onChange={(v) => setForm({ ...form, notes: v })}
                  placeholder="Notas... escribe $categoria para vincular"
                />
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
                    list="tag-suggestions"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
                    placeholder="trabajo, viaje, deducible..."
                    className="flex-1"
                  />
                  {knownTags.length > 0 && (
                    <datalist id="tag-suggestions">
                      {knownTags.filter((t) => !form.tags.includes(t)).map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  )}
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

              {/* Privacy */}
              <div className="col-span-2 space-y-1.5">
                <Label>Privacidad</Label>
                <div className="flex gap-2">
                  {([
                    { value: "private", label: "🔒 Privado" },
                    { value: "group",   label: "👥 Grupo" },
                    { value: "public",  label: "🌍 Público" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, privacy: opt.value })}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                        form.privacy === opt.value
                          ? "border-foreground bg-accent font-semibold"
                          : "border-border text-muted-foreground hover:border-muted-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
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
                      type="number" inputMode="decimal"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                      className="w-14 h-8 text-xs tabular-nums text-center"
                      title="Cantidad"
                    />
                    <Input
                      type="number" inputMode="decimal"
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

          <DialogFooter className="pt-2 flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-destructive mr-auto"
              onClick={async () => {
                if (!expense) return
                await archiveExpense.mutateAsync(expense.id)
                toast.success("Gasto archivado")
                onClose()
              }}
              disabled={archiveExpense.isPending}
            >
              <Archive className="h-4 w-4" />
              Archivar
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={() => setSplitOpen(true)}
            >
              <Split className="h-4 w-4" />
              Dividir
            </Button>
            <Button type="submit" disabled={updateExpense.isPending}>
              {updateExpense.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <QuickSplit
        open={splitOpen}
        onClose={() => setSplitOpen(false)}
        initialAmount={parseFloat(form.total) || undefined}
        initialDescription={form.merchant || undefined}
      />
    </Dialog>
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-border/50" />
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 shrink-0">{label}</span>
      <div className="h-px flex-1 bg-border/50" />
    </div>
  )
}
