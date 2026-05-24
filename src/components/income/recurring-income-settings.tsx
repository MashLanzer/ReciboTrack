"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import {
  useRecurringIncome,
  useAddRecurringIncome,
  useUpdateRecurringIncome,
  useDeleteRecurringIncome,
  type RecurringIncomeInput,
} from "@/hooks/use-recurring-income"
import { formatCurrency, cn } from "@/lib/utils"
import { CURRENCIES } from "@/lib/constants"
import { Skeleton } from "@/components/ui/skeleton"

const SOURCE_META: Record<string, { emoji: string }> = {
  "Nómina":      { emoji: "💼" },
  "Freelance":   { emoji: "💻" },
  "Inversiones": { emoji: "📈" },
  "Alquiler":    { emoji: "🏠" },
  "Otro":        { emoji: "📦" },
}

const SOURCES = ["Nómina", "Freelance", "Inversiones", "Alquiler", "Otro"]

const FREQUENCY_LABELS: Record<string, string> = {
  weekly:    "Semanal",
  biweekly:  "Quincenal",
  monthly:   "Mensual",
  yearly:    "Anual",
}

const FREQUENCY_OPTIONS = ["weekly", "biweekly", "monthly", "yearly"] as const

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

export function RecurringIncomeSettings() {
  const { data: templates = [], isLoading } = useRecurringIncome()
  const addMutation = useAddRecurringIncome()
  const updateMutation = useUpdateRecurringIncome()
  const deleteMutation = useDeleteRecurringIncome()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<RecurringIncomeInput>(emptyForm)
  const [isOpen, setIsOpen] = useState(true)

  function handleField<K extends keyof RecurringIncomeInput>(key: K, value: RecurringIncomeInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim() || form.amount <= 0 || !form.nextDueDate) return
    await addMutation.mutateAsync(form)
    setForm(emptyForm)
    setShowForm(false)
  }

  function handleToggleActive(id: string, current: boolean) {
    updateMutation.mutate({ id, isActive: !current })
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id)
  }

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header — collapsible */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Ingresos recurrentes
        </p>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          {/* Template list */}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : templates.length === 0 && !showForm ? (
            <p className="text-xs text-muted-foreground py-2">
              Sin plantillas. Añade una para recordar ingresos periódicos.
            </p>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => {
                const meta = SOURCE_META[t.source] ?? SOURCE_META["Otro"]
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-opacity",
                      !t.isActive && "opacity-50"
                    )}
                  >
                    <span className="text-lg shrink-0">{meta.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{t.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {FREQUENCY_LABELS[t.frequency] ?? t.frequency} ·{" "}
                        {t.nextDueDate}
                      </p>
                    </div>
                    <p className="text-sm font-bold tabular-nums shrink-0">
                      {formatCurrency(t.amount, t.currency)}
                    </p>
                    {/* Toggle active */}
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
                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Inline add form */}
          {showForm ? (
            <form onSubmit={handleSubmit} className="rounded-xl border p-3 space-y-3 bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nueva plantilla
              </p>

              {/* Description */}
              <input
                type="text"
                placeholder="Descripción (ej. Salario mensual)"
                value={form.description}
                onChange={(e) => handleField("description", e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />

              <div className="grid grid-cols-2 gap-2">
                {/* Source */}
                <select
                  value={form.source}
                  onChange={(e) => handleField("source", e.target.value)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                {/* Frequency */}
                <select
                  value={form.frequency}
                  onChange={(e) => handleField("frequency", e.target.value as RecurringIncomeInput["frequency"])}
                  className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {FREQUENCY_OPTIONS.map((f) => (
                    <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Amount */}
                <input
                  type="number"
                  placeholder="Monto"
                  min={0}
                  step="0.01"
                  value={form.amount || ""}
                  onChange={(e) => handleField("amount", parseFloat(e.target.value) || 0)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />

                {/* Currency */}
                <select
                  value={form.currency}
                  onChange={(e) => handleField("currency", e.target.value)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Next due date */}
              <input
                type="date"
                value={form.nextDueDate}
                onChange={(e) => handleField("nextDueDate", e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />

              {/* Account */}
              <select
                value={form.account}
                onChange={(e) => handleField("account", e.target.value as "personal" | "business")}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="personal">Personal</option>
                <option value="business">Negocio</option>
              </select>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="flex-1 rounded-lg bg-income text-white py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {addMutation.isPending ? "Guardando…" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setForm(emptyForm) }}
                  className="flex-1 rounded-lg bg-muted py-2 text-sm font-semibold hover:bg-muted/80 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Añadir recurrente
            </button>
          )}
        </div>
      )}
    </div>
  )
}
