"use client"

import { useState } from "react"
import {
  useCategoryRules,
  useAddCategoryRule,
  useUpdateCategoryRule,
  useDeleteCategoryRule,
} from "@/hooks/use-category-rules"
import { useCategories } from "@/hooks/use-categories"
import { DEFAULT_CATEGORIES } from "@/lib/constants"
import type { CategoryRule, RuleField, RuleOperator } from "@/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
import { Plus, Trash2, Pencil, Zap, Info } from "lucide-react"

// ─── Constants ────────────────────────────────────────────────────────────────

const FIELDS: { value: RuleField; label: string; hint: string }[] = [
  { value: "merchant",   label: "Comerciante",  hint: "Nombre del establecimiento" },
  { value: "notes",      label: "Notas",        hint: "Texto en el campo de notas" },
  { value: "amount_min", label: "Importe mín.", hint: "Gasto mayor o igual a este valor" },
  { value: "amount_max", label: "Importe máx.", hint: "Gasto menor o igual a este valor" },
]

const OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: "contains",    label: "contiene" },
  { value: "starts_with", label: "empieza por" },
  { value: "equals",      label: "es exactamente" },
]

function emptyForm() {
  return {
    name: "",
    field: "merchant" as RuleField,
    operator: "contains" as RuleOperator,
    value: "",
    categoryId: "otros",
    enabled: true,
  }
}

// ─── Rule card ────────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  catName,
  catIcon,
  onEdit,
  onDelete,
  onToggle,
}: {
  rule: CategoryRule
  catName: string
  catIcon: string
  onEdit: () => void
  onDelete: () => void
  onToggle: (enabled: boolean) => void
}) {
  const fieldMeta = FIELDS.find((f) => f.value === rule.field)
  const opMeta = OPERATORS.find((o) => o.value === rule.operator)
  const isAmountRule = rule.field === "amount_min" || rule.field === "amount_max"

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 border-b last:border-0 transition-opacity",
      !rule.enabled && "opacity-50"
    )}>
      {/* Toggle */}
      <Switch
        checked={rule.enabled}
        onCheckedChange={onToggle}
        className="shrink-0"
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium">{rule.name}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isAmountRule
            ? `Si ${fieldMeta?.label?.toLowerCase()} ${rule.value} → ${catIcon} ${catName}`
            : `Si ${fieldMeta?.label?.toLowerCase()} ${opMeta?.label} "${rule.value}" → ${catIcon} ${catName}`
          }
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEdit}
          className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Rule form dialog ─────────────────────────────────────────────────────────

function RuleDialog({
  open,
  onClose,
  editing,
  ruleCount,
}: {
  open: boolean
  onClose: () => void
  editing: CategoryRule | null
  ruleCount: number
}) {
  const { data: categories = [] } = useCategories()
  const allCats = categories.length > 0 ? categories : DEFAULT_CATEGORIES
  const addRule = useAddCategoryRule()
  const updateRule = useUpdateCategoryRule()

  const [form, setForm] = useState(() =>
    editing
      ? {
          name: editing.name,
          field: editing.field,
          operator: editing.operator,
          value: editing.value,
          categoryId: editing.categoryId,
          enabled: editing.enabled,
        }
      : emptyForm()
  )

  const isAmountField = form.field === "amount_min" || form.field === "amount_max"

  function set(key: string, val: unknown) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleSave() {
    if (!form.name.trim() || !form.value.trim()) {
      toast.error("Rellena todos los campos obligatorios")
      return
    }
    try {
      if (editing) {
        await updateRule.mutateAsync({ id: editing.id, input: form })
        toast.success("Regla actualizada")
      } else {
        await addRule.mutateAsync({ ...form, order: ruleCount })
        toast.success("Regla creada")
      }
      onClose()
    } catch {
      toast.error("Error al guardar la regla")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            {editing ? "Editar regla" : "Nueva regla"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs mb-1 block">Nombre de la regla *</Label>
            <Input
              placeholder="Ej: Gasolineras → Combustible"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs mb-1 block">Campo</Label>
              <Select value={form.field} onValueChange={(v) => set("field", v as RuleField)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELDS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isAmountField && (
              <div>
                <Label className="text-xs mb-1 block">Condición</Label>
                <Select value={form.operator} onValueChange={(v) => set("operator", v as RuleOperator)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs mb-1 block">
              {isAmountField ? "Valor (importe)" : "Valor a buscar *"}
            </Label>
            <Input
              placeholder={isAmountField ? "50.00" : "Shell, Mercadona, Netflix..."}
              type={isAmountField ? "number" : "text"}
              value={form.value}
              onChange={(e) => set("value", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div>
            <Label className="text-xs mb-1 block">Categoría resultante</Label>
            <Select value={form.categoryId} onValueChange={(v) => set("categoryId", v)}>
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

          {/* Preview */}
          {form.value && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-mono">
                {isAmountField
                  ? `Si importe ${form.field === "amount_min" ? "≥" : "≤"} ${form.value} → ${allCats.find(c => c.id === form.categoryId)?.name}`
                  : `Si ${FIELDS.find(f => f.value === form.field)?.label?.toLowerCase()} ${OPERATORS.find(o => o.value === form.operator)?.label} "${form.value}" → ${allCats.find(c => c.id === form.categoryId)?.name}`
                }
              </span>
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleSave}
            disabled={addRule.isPending || updateRule.isPending}
          >
            {editing ? "Guardar cambios" : "Crear regla"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CategoryRules() {
  const { data: rules = [], isLoading } = useCategoryRules()
  const { data: categories = [] } = useCategories()
  const deleteRule = useDeleteCategoryRule()
  const updateRule = useUpdateCategoryRule()
  const allCats = categories.length > 0 ? categories : DEFAULT_CATEGORIES

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryRule | null>(null)

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(rule: CategoryRule) {
    setEditing(rule)
    setDialogOpen(true)
  }

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Reglas automáticas</h2>
          {rules.length > 0 && (
            <Badge variant="secondary" className="text-xs">{rules.length}</Badge>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          Nueva regla
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-muted/50 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <p>
          Las reglas se aplican automáticamente al escanear recibos e importar CSV. Se evalúan en orden, gana la primera que coincide.
        </p>
      </div>

      {/* Rule list */}
      {isLoading ? (
        <div className="rounded-2xl border bg-card p-4 text-center text-sm text-muted-foreground">
          Cargando reglas...
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-6 text-center">
          <Zap className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">Sin reglas aún</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crea reglas para que la app categorice tus gastos automáticamente
          </p>
          <Button size="sm" className="mt-3 gap-1.5" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Crear primera regla
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          {rules.map((rule) => {
            const cat = allCats.find((c) => c.id === rule.categoryId)
            return (
              <RuleCard
                key={rule.id}
                rule={rule}
                catName={cat?.name ?? rule.categoryId}
                catIcon={cat?.icon ?? "📦"}
                onEdit={() => openEdit(rule)}
                onDelete={() => {
                  deleteRule.mutate(rule.id)
                  toast.success("Regla eliminada")
                }}
                onToggle={(enabled) => updateRule.mutate({ id: rule.id, input: { enabled } })}
              />
            )
          })}
        </div>
      )}

      <RuleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
        ruleCount={rules.length}
      />
    </section>
  )
}
