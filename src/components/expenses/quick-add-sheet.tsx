"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useAddExpense, useExpensesPeriod } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { useUIStore } from "@/stores/ui-store"
import { CategorySuggestion } from "@/components/shared/category-suggestion"
import { DEFAULT_CATEGORIES, CURRENCIES } from "@/lib/constants"
import { formatCurrency, cn } from "@/lib/utils"
import { subMonths } from "date-fns"
import { format } from "date-fns"
import { X, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

// ─── Component ────────────────────────────────────────────────────────────────

export function QuickAddSheet() {
  const { quickAddOpen, setQuickAddOpen, setRoundupExpense } = useUIStore()
  const { data: categories = [] } = useCategories()
  const addExpense = useAddExpense()
  const allCats = categories.length > 0 ? categories : DEFAULT_CATEGORIES
  const merchantRef = useRef<HTMLInputElement>(null)

  const today = format(new Date(), "yyyy-MM-dd")

  const [form, setForm] = useState({
    merchant: "",
    total: "",
    category: "otros",
    currency: "USD",
    date: today,
    notes: "",
  })

  // ── Known merchants from last 6 months (for datalist autocomplete) ──────────
  const now = useMemo(() => new Date(), [])
  const sixMonthsAgo = useMemo(() => subMonths(now, 6), [now])
  const { data: recentExpenses = [] } = useExpensesPeriod(sixMonthsAgo, now)

  const knownMerchants = useMemo(() => {
    const set = new Set<string>()
    recentExpenses.forEach((e) => { if (e.merchant) set.add(e.merchant) })
    return [...set].sort()
  }, [recentExpenses])

  // Reset and focus when opened
  useEffect(() => {
    if (quickAddOpen) {
      setForm({ merchant: "", total: "", category: "otros", currency: "USD", date: today, notes: "" })
      setTimeout(() => merchantRef.current?.focus(), 150)
    }
  }, [quickAddOpen, today])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && quickAddOpen) setQuickAddOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [quickAddOpen, setQuickAddOpen])

  async function handleSave() {
    const totalNum = parseFloat(form.total)
    if (!form.merchant.trim() || isNaN(totalNum) || totalNum <= 0) {
      toast.error("Completa comercio y monto")
      return
    }
    try {
      const { Timestamp } = await import("firebase/firestore")
      const expenseDate = new Date(form.date + "T12:00:00")
      const id = await addExpense.mutateAsync({
        merchant: form.merchant.trim(),
        date: expenseDate,
        total: totalNum,
        subtotal: totalNum,
        tax: 0,
        category: form.category,
        currency: form.currency,
        notes: form.notes.trim(),
        paymentMethod: null,
        reference: null,
        tags: [],
        items: [],
        receiptImageUrl: null,
      })
      const isOffline = !navigator.onLine
      toast.success(isOffline ? "Guardado localmente" : "Gasto añadido", {
        description: isOffline ? "Se sincronizará al reconectar" : undefined,
      })
      setQuickAddOpen(false)
      // Trigger round-up prompt if total is not a whole number
      const diff = Math.ceil(totalNum) - totalNum
      if (diff > 0 && typeof id === "string") {
        const now = Timestamp.now()
        setRoundupExpense({
          id,
          merchant: form.merchant.trim(),
          date: Timestamp.fromDate(expenseDate),
          total: totalNum,
          subtotal: totalNum,
          tax: 0,
          category: form.category,
          currency: form.currency,
          notes: form.notes.trim(),
          paymentMethod: null,
          reference: null,
          tags: [],
          items: [],
          receiptImageUrl: null,
          createdAt: now,
          updatedAt: now,
        })
      }
    } catch {
      toast.error("Error al guardar")
    }
  }

  if (!quickAddOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
        onClick={() => setQuickAddOpen(false)}
      />

      {/* Sheet */}
      <div className="fixed bottom-16 left-0 right-0 z-50 md:hidden animate-in slide-in-from-bottom-4 duration-200">
        <div className="mx-3 mb-2 rounded-2xl border bg-background shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b">
            <h2 className="text-sm font-semibold">Gasto rápido</h2>
            <button
              onClick={() => setQuickAddOpen(false)}
              className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Form */}
          <div className="p-4 space-y-3">
            {/* Merchant + category suggestion */}
            <div className="space-y-1.5">
              <Input
                ref={merchantRef}
                id="qs-merchant"
                list="qs-merchant-list"
                placeholder="Comercio o descripción"
                value={form.merchant}
                onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
                className="h-10"
                autoComplete="off"
              />
              {knownMerchants.length > 0 && (
                <datalist id="qs-merchant-list">
                  {knownMerchants.map((m) => <option key={m} value={m} />)}
                </datalist>
              )}
              {/* Category auto-suggestion */}
              <CategorySuggestion
                merchant={form.merchant}
                currentCategory={form.category}
                onAccept={(cat) => setForm((f) => ({ ...f, category: cat }))}
              />
            </div>

            {/* Amount + Currency */}
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0.00"
                value={form.total}
                onChange={(e) => setForm((f) => ({ ...f, total: e.target.value }))}
                className="flex-1 h-10 tabular-nums text-lg font-semibold"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="h-10 rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Category pills */}
            <div className="overflow-x-auto scrollbar-none">
              <div className="flex gap-1.5 pb-1">
                {allCats.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setForm((f) => ({ ...f, category: cat.id }))}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0",
                      form.category === cat.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date + Notes row */}
            <div className="flex gap-2">
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="h-9 text-sm flex-1"
              />
              <Input
                placeholder="Notas opcionales"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="h-9 text-sm flex-1"
              />
            </div>
          </div>

          {/* Save */}
          <div className="px-4 pb-4">
            <Button
              className="w-full h-11 gap-2 text-sm font-semibold"
              onClick={handleSave}
              disabled={addExpense.isPending || !form.merchant.trim() || !form.total}
            >
              <Check className="h-4 w-4" />
              {addExpense.isPending
                ? "Guardando…"
                : `Añadir ${form.total ? formatCurrency(parseFloat(form.total) || 0, form.currency) : "gasto"}`}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
