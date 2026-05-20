"use client"

import { useState } from "react"
import {
  useAutomations,
  useCreateAutomation,
  useUpdateAutomation,
  useDeleteAutomation,
  type AutomationRule,
  type AutomationTrigger,
  type AutomationAction,
} from "@/hooks/use-automations"
import { toast } from "sonner"
import { Plus, Trash2, Zap, ToggleLeft, ToggleRight, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// ─── Labels ──────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  expense_over:   "Gasto individual supera",
  budget_pct:     "Presupuesto mensual supera",
  category_over:  "Categoría supera",
  recurring_due:  "Recurrente vence en",
}

const ACTION_LABELS: Record<AutomationAction, string> = {
  webhook:      "Enviar webhook",
  notification: "Notificación en la app",
  tag:          "Etiquetar gasto automáticamente",
}

function triggerDescription(rule: AutomationRule): string {
  switch (rule.trigger) {
    case "expense_over":  return `gasto > ${rule.triggerValue}`
    case "budget_pct":    return `presupuesto > ${rule.triggerValue}%`
    case "category_over": return `${rule.triggerCategory ?? "categoría"} > ${rule.triggerValue}`
    case "recurring_due": return `vence en ${rule.triggerValue} días`
  }
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  name: string
  trigger: AutomationTrigger
  triggerValue: string
  triggerCategory: string
  action: AutomationAction
  actionValue: string
}

function emptyForm(): FormState {
  return {
    name: "",
    trigger: "expense_over",
    triggerValue: "100",
    triggerCategory: "",
    action: "notification",
    actionValue: "",
  }
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  onToggle,
  onDelete,
  onEdit,
}: {
  rule: AutomationRule
  onToggle: () => void
  onDelete: () => void
  onEdit: () => void
}) {
  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-2 transition-opacity",
      !rule.enabled && "opacity-50"
    )}>
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{rule.name}</p>
          <p className="text-xs text-muted-foreground">
            Si <span className="font-medium text-foreground">{triggerDescription(rule)}</span>{" "}
            → <span className="font-medium text-foreground">{ACTION_LABELS[rule.action]}</span>
          </p>
          {rule.actionValue && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {rule.actionValue}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onToggle} className="text-muted-foreground hover:text-foreground transition-colors">
            {rule.enabled
              ? <ToggleRight className="h-5 w-5 text-primary" />
              : <ToggleLeft className="h-5 w-5" />}
          </button>
          <button onClick={onEdit} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {rule.lastFiredAt && (
        <p className="text-[11px] text-muted-foreground pl-11">
          Última ejecución:{" "}
          {rule.lastFiredAt.toDate().toLocaleDateString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
    </div>
  )
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

function RuleDialog({
  open,
  initial,
  onClose,
  onSave,
  saving,
}: {
  open: boolean
  initial: FormState
  onClose: () => void
  onSave: (form: FormState) => void
  saving: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)
  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }))

  // Sync when initial changes (edit mode)
  useState(() => { setForm(initial) })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            {initial.name ? "Editar automatización" : "Nueva automatización"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs mb-1 block">Nombre *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ej. Alerta de gasto grande"
              className="h-8 text-sm"
              autoFocus
            />
          </div>

          <div>
            <Label className="text-xs mb-1 block">Disparador</Label>
            <Select value={form.trigger} onValueChange={(v) => set("trigger", v as AutomationTrigger)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(TRIGGER_LABELS) as [AutomationTrigger, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs mb-1 block">
                {form.trigger === "budget_pct" ? "Porcentaje (%)" :
                  form.trigger === "recurring_due" ? "Días antes" : "Importe"}
              </Label>
              <Input
                type="number"
                value={form.triggerValue}
                onChange={(e) => set("triggerValue", e.target.value)}
                className="h-8 text-sm tabular-nums"
                min={0}
              />
            </div>
            {form.trigger === "category_over" && (
              <div>
                <Label className="text-xs mb-1 block">Categoría</Label>
                <Input
                  value={form.triggerCategory}
                  onChange={(e) => set("triggerCategory", e.target.value)}
                  placeholder="comida, ocio..."
                  className="h-8 text-sm"
                />
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs mb-1 block">Acción</Label>
            <Select value={form.action} onValueChange={(v) => set("action", v as AutomationAction)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(ACTION_LABELS) as [AutomationAction, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(form.action === "webhook" || form.action === "tag") && (
            <div>
              <Label className="text-xs mb-1 block">
                {form.action === "webhook" ? "URL del webhook" : "Etiqueta"}
              </Label>
              <Input
                value={form.actionValue}
                onChange={(e) => set("actionValue", e.target.value)}
                placeholder={form.action === "webhook" ? "https://..." : "gran-gasto"}
                className="h-8 text-sm"
              />
            </div>
          )}

          <Button
            className="w-full"
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim()}
          >
            {initial.name ? "Guardar cambios" : "Crear automatización"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AutomationsClient() {
  const { data: rules = [], isLoading } = useAutomations()
  const create = useCreateAutomation()
  const update = useUpdateAutomation()
  const remove = useDeleteAutomation()

  const [open, setOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null)
  const [dialogForm, setDialogForm] = useState<FormState>(emptyForm())

  function openCreate() {
    setEditingRule(null)
    setDialogForm(emptyForm())
    setOpen(true)
  }

  function openEdit(rule: AutomationRule) {
    setEditingRule(rule)
    setDialogForm({
      name: rule.name,
      trigger: rule.trigger,
      triggerValue: String(rule.triggerValue),
      triggerCategory: rule.triggerCategory ?? "",
      action: rule.action,
      actionValue: rule.actionValue,
    })
    setOpen(true)
  }

  async function handleSave(form: FormState) {
    if (!form.name.trim()) { toast.error("El nombre es requerido"); return }
    const payload = {
      name: form.name.trim(),
      enabled: true,
      trigger: form.trigger,
      triggerValue: parseFloat(form.triggerValue) || 0,
      ...(form.triggerCategory ? { triggerCategory: form.triggerCategory } : {}),
      action: form.action,
      actionValue: form.actionValue,
    }
    try {
      if (editingRule) {
        await update.mutateAsync({ id: editingRule.id, updates: payload })
        toast.success("Automatización actualizada")
      } else {
        await create.mutateAsync(payload)
        toast.success("Automatización creada")
      }
      setOpen(false)
    } catch {
      toast.error("Error al guardar")
    }
  }

  async function handleToggle(rule: AutomationRule) {
    try {
      await update.mutateAsync({ id: rule.id, updates: { enabled: !rule.enabled } })
    } catch {
      toast.error("Error al actualizar")
    }
  }

  async function handleDelete(id: string) {
    try {
      await remove.mutateAsync(id)
      toast.success("Automatización eliminada")
    } catch {
      toast.error("Error al eliminar")
    }
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Automatizaciones
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reglas que se ejecutan automáticamente al cumplirse una condición
          </p>
        </div>
        <Button className="gap-1.5 shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nueva regla
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-muted/20 p-12 text-center space-y-3">
          <Zap className="h-12 w-12 mx-auto text-muted-foreground opacity-30" />
          <div>
            <p className="font-semibold">Sin automatizaciones</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              Crea reglas para recibir alertas o ejecutar acciones cuando se cumplan condiciones en tus gastos
            </p>
          </div>
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Crear primera regla
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={() => handleToggle(rule)}
              onDelete={() => handleDelete(rule.id)}
              onEdit={() => openEdit(rule)}
            />
          ))}
        </div>
      )}

      <RuleDialog
        key={editingRule?.id ?? "new"}
        open={open}
        initial={dialogForm}
        onClose={() => setOpen(false)}
        onSave={handleSave}
        saving={create.isPending || update.isPending}
      />
    </div>
  )
}
