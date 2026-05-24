"use client"

import { useState } from "react"
import { useCategories, useAddCategory, useUpdateCategory, useDeleteCategory } from "@/hooks/use-categories"
import type { CategoryDoc } from "@/types"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "sonner"
import { Plus, Edit, Trash2, Loader2 } from "lucide-react"

const PRESET_COLORS = [
  "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7",
  "#ef4444", "#06b6d4", "#f59e0b", "#6b7280", "#ec4899",
]

interface FormData {
  name: string
  icon: string
  color: string
}

export function CategoriesManager() {
  const { data: categories = [], isLoading } = useCategories()
  const addCategory = useAddCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryDoc | null>(null)
  const [form, setForm] = useState<FormData>({ name: "", icon: "📦", color: "#6b7280" })
  const [deleteTarget, setDeleteTarget] = useState<CategoryDoc | null>(null)

  function openCreate() {
    setEditing(null)
    setForm({ name: "", icon: "📦", color: "#6b7280" })
    setDialogOpen(true)
  }

  function openEdit(cat: CategoryDoc) {
    setEditing(cat)
    setForm({ name: cat.name, icon: cat.icon, color: cat.color })
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editing) {
        await updateCategory.mutateAsync({ id: editing.id, input: form })
        toast.success("Categoría actualizada")
      } else {
        await addCategory.mutateAsync(form)
        toast.success("Categoría creada")
      }
      setDialogOpen(false)
    } catch {
      toast.error("Error al guardar")
    }
  }

  function handleDelete(cat: CategoryDoc) {
    setDeleteTarget(cat)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteCategory.mutateAsync(deleteTarget.id)
      toast.success("Categoría eliminada")
    } catch {
      toast.error("Error al eliminar")
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-3">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    )
  }

  const defaults = categories.filter((c) => c.isDefault)
  const custom = categories.filter((c) => !c.isDefault)

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title={`¿Eliminar la categoría "${deleteTarget?.name}"?`}
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
      />

      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-px flex-1 bg-border/50" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">Predeterminadas</p>
          <div className="h-px flex-1 bg-border/50" />
        </div>
        <div className="grid gap-1.5">
          {defaults.map((cat) => (
            <div
              key={cat.id}
              className="group flex items-center gap-3 py-2.5 px-3 rounded-xl border bg-card border-l-[3px] transition-all duration-150 hover:bg-muted/40 hover:shadow-sm"
              style={{ borderLeftColor: cat.color }}
            >
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center text-base shrink-0"
                style={{ backgroundColor: `${cat.color}20` }}
              >
                {cat.icon}
              </div>
              <p className="text-sm font-medium flex-1 truncate">{cat.name}</p>
              <div className="h-2 w-2 rounded-full shrink-0 opacity-50" style={{ backgroundColor: cat.color }} />
            </div>
          ))}
        </div>
      </div>

      {custom.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-border/50" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">Personalizadas</p>
            <div className="h-px flex-1 bg-border/50" />
          </div>
          <div className="grid gap-1.5">
            {custom.map((cat) => (
              <div
                key={cat.id}
                className="group flex items-center gap-3 py-2.5 px-3 rounded-xl border bg-card border-l-[3px] transition-all duration-150 hover:bg-muted/40 hover:shadow-sm"
                style={{ borderLeftColor: cat.color }}
              >
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ backgroundColor: `${cat.color}20` }}
                >
                  {cat.icon}
                </div>
                <p className="text-sm font-semibold flex-1 truncate">{cat.name}</p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(cat)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button className="w-full gap-2" variant="outline" onClick={openCreate}>
        <Plus className="h-4 w-4" />
        Nueva categoría
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Icono (emoji)</Label>
              <Input
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="📦"
                className="text-2xl text-center"
                maxLength={4}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Mi categoría"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-7 w-7 rounded-full transition-transform ${form.color === color ? "scale-110 ring-2 ring-offset-2 ring-foreground" : ""}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setForm({ ...form, color })}
                  />
                ))}
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-7 w-7 rounded-full border-0 p-0 cursor-pointer"
                  title="Color personalizado"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-xl"
                style={{ backgroundColor: `${form.color}20` }}
              >
                {form.icon}
              </div>
              <p className="text-sm font-medium">{form.name || "Nombre de categoría"}</p>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={addCategory.isPending || updateCategory.isPending}>
                {(addCategory.isPending || updateCategory.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
