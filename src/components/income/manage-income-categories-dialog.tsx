"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, Check, X } from "lucide-react"
import {
  useIncomeCategories,
  useAddIncomeCategory,
  useUpdateIncomeCategory,
  useDeleteIncomeCategory,
  DEFAULT_INCOME_CATEGORIES,
  type IncomeCategory,
} from "@/hooks/use-income-categories"

const PRESET_COLORS = [
  "#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ec4899",
  "#14b8a6", "#f97316", "#ef4444", "#64748b", "#a78bfa",
]

const PRESET_EMOJIS = ["💼", "💻", "📈", "🏠", "🛒", "🎁", "↩️", "📦", "💰", "🏦", "🎯", "⭐"]

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
}

interface EditingForm {
  name: string
  emoji: string
  color: string
}

function emptyForm(): EditingForm {
  return { name: "", emoji: "📦", color: "#6b7280" }
}

export function ManageIncomeCategoriesDialog({ open, onOpenChange }: Props) {
  const { data: categories = [] } = useIncomeCategories()
  const addCat = useAddIncomeCategory()
  const updateCat = useUpdateIncomeCategory()
  const deleteCat = useDeleteIncomeCategory()

  const [mode, setMode] = useState<"list" | "add" | "edit">("list")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EditingForm>(emptyForm())

  function startAdd() {
    setForm(emptyForm())
    setEditingId(null)
    setMode("add")
  }

  function startEdit(cat: IncomeCategory) {
    setForm({ name: cat.name, emoji: cat.emoji, color: cat.color })
    setEditingId(cat.id)
    setMode("edit")
  }

  function cancelEdit() {
    setMode("list")
    setEditingId(null)
    setForm(emptyForm())
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio")
      return
    }
    try {
      if (mode === "add") {
        await addCat.mutateAsync({ name: form.name.trim(), emoji: form.emoji, color: form.color })
        toast.success("Categoría creada")
      } else if (mode === "edit" && editingId) {
        await updateCat.mutateAsync({ id: editingId, input: { name: form.name.trim(), emoji: form.emoji, color: form.color } })
        toast.success("Categoría actualizada")
      }
      cancelEdit()
    } catch {
      toast.error("Error al guardar")
    }
  }

  async function handleDelete(id: string, name: string) {
    try {
      await deleteCat.mutateAsync(id)
      toast.success(`"${name}" eliminada`)
    } catch {
      toast.error("Error al eliminar")
    }
  }

  const isSaving = addCat.isPending || updateCat.isPending

  const displayCategories = categories.length > 0
    ? categories
    : DEFAULT_INCOME_CATEGORIES.map((d, i) => ({ ...d, id: `default-${i}`, createdAt: null }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg">📂</span>
            Categorías de ingresos
          </DialogTitle>
        </DialogHeader>

        {(mode === "add" || mode === "edit") ? (
          /* ── Form ── */
          <div className="space-y-4">
            {/* Emoji picker */}
            <div className="space-y-1.5">
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setForm({ ...form, emoji: e })}
                    className={`h-9 w-9 rounded-xl text-lg flex items-center justify-center transition-all ${
                      form.emoji === e
                        ? "ring-2 ring-primary bg-primary/10 scale-110"
                        : "bg-muted hover:bg-muted/70"
                    }`}
                  >
                    {e}
                  </button>
                ))}
                {/* Custom emoji input */}
                <Input
                  maxLength={2}
                  placeholder="✏️"
                  value={PRESET_EMOJIS.includes(form.emoji) ? "" : form.emoji}
                  onChange={(e) => setForm({ ...form, emoji: e.target.value || "📦" })}
                  className="h-9 w-16 text-center text-lg p-1"
                />
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input
                placeholder="Ej: Dividendos, Consultoría..."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>

            {/* Color picker */}
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2 items-center">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`h-7 w-7 rounded-full transition-all ${
                      form.color === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-7 w-7 rounded-full cursor-pointer border-0 p-0 bg-transparent"
                  title="Color personalizado"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-xl border p-3 flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center text-base shrink-0"
                style={{ backgroundColor: `${form.color}25` }}
              >
                {form.emoji}
              </div>
              <p className="text-sm font-medium">{form.name || "Vista previa"}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancelEdit} className="flex-1" disabled={isSaving}>
                <X className="h-4 w-4 mr-1.5" />
                Cancelar
              </Button>
              <Button onClick={handleSave} className="flex-1" disabled={isSaving || !form.name.trim()}>
                <Check className="h-4 w-4 mr-1.5" />
                {mode === "add" ? "Crear" : "Guardar"}
              </Button>
            </div>
          </div>
        ) : (
          /* ── Category list ── */
          <div className="space-y-3">
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Usarás las categorías predeterminadas. Puedes crear las tuyas aquí.
              </p>
            )}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {displayCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                >
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: `${cat.color}25` }}
                  >
                    {cat.emoji}
                  </div>
                  <p className="flex-1 text-sm font-medium">{cat.name}</p>
                  {!cat.id.startsWith("default-") && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEdit(cat as IncomeCategory)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(cat.id, cat.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button onClick={startAdd} className="w-full" variant="outline">
              <Plus className="h-4 w-4 mr-1.5" />
              Nueva categoría
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
