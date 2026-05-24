"use client"

import { useState } from "react"
import { useBulkDeleteExpenses, useBulkUpdateExpenses } from "@/hooks/use-expenses"
import { useCategories } from "@/hooks/use-categories"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "sonner"
import { Trash2, Archive, Tag, X } from "lucide-react"

interface BulkActionsBarProps {
  selectedIds: string[]
  onClear: () => void
  onDeleted: () => void
}

export function BulkActionsBar({ selectedIds, onClear, onDeleted }: BulkActionsBarProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [catValue, setCatValue] = useState("")

  const { data: categories = [] } = useCategories()
  const bulkDelete = useBulkDeleteExpenses()
  const bulkUpdate = useBulkUpdateExpenses()

  if (selectedIds.length === 0) return null

  const n = selectedIds.length
  const label = `${n} seleccionado${n !== 1 ? "s" : ""}`

  async function handleDelete() {
    try {
      await bulkDelete.mutateAsync(selectedIds)
      toast.success(`${n} gasto${n !== 1 ? "s" : ""} eliminado${n !== 1 ? "s" : ""}`)
      onDeleted()
      onClear()
    } catch {
      toast.error("Error al eliminar los gastos")
    }
  }

  async function handleArchive() {
    try {
      await bulkUpdate.mutateAsync({ ids: selectedIds, updates: { archived: true } })
      toast.success(`${n} gasto${n !== 1 ? "s" : ""} archivado${n !== 1 ? "s" : ""}`)
      onClear()
    } catch {
      toast.error("Error al archivar los gastos")
    }
  }

  async function handleCategory() {
    if (!catValue) return
    try {
      await bulkUpdate.mutateAsync({ ids: selectedIds, updates: { category: catValue } })
      toast.success(`Categoría actualizada en ${n} gasto${n !== 1 ? "s" : ""}`)
      setCatOpen(false)
      setCatValue("")
      onClear()
    } catch {
      toast.error("Error al cambiar la categoría")
    }
  }

  return (
    <>
      <div className="fixed bottom-16 md:bottom-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        <div className="slide-up-fade pointer-events-auto flex items-center gap-2 bg-foreground text-background rounded-2xl px-3 py-2.5 shadow-2xl border border-foreground/10 max-w-[calc(100vw-2rem)] overflow-x-auto">
          <span className="text-sm font-medium tabular-nums shrink-0">{label}</span>
          <span className="text-foreground/30 select-none shrink-0">·</span>

          <div className="flex gap-1.5 ml-1 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="h-8 text-xs gap-1 bg-background/15 hover:bg-background/25 text-background border-0 shrink-0"
              onClick={() => setArchiveOpen(true)}
            >
              <Archive className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Archivar</span>
            </Button>

            <Button
              size="sm"
              variant="secondary"
              className="h-8 text-xs gap-1 bg-background/15 hover:bg-background/25 text-background border-0 shrink-0"
              onClick={() => setCatOpen(true)}
            >
              <Tag className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Categoría</span>
            </Button>

            <Button
              size="sm"
              variant="secondary"
              className="h-8 text-xs gap-1 bg-destructive/80 hover:bg-destructive text-white border-0 shrink-0"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Eliminar</span>
            </Button>
          </div>

          <button
            onClick={onClear}
            className="ml-1 shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Deseleccionar todo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`¿Eliminar ${n} gasto${n !== 1 ? "s" : ""}?`}
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={bulkDelete.isPending}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`¿Archivar ${n} gasto${n !== 1 ? "s" : ""}?`}
        description="Los gastos archivados se ocultarán de la lista principal."
        confirmLabel="Archivar"
        variant="default"
        loading={bulkUpdate.isPending}
        onConfirm={handleArchive}
      />

      {catOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCatOpen(false)} />
          <div className="relative bg-background rounded-2xl border shadow-2xl p-5 w-full max-w-xs space-y-3">
            <p className="text-sm font-semibold">
              Cambiar categoría — {n} gasto{n !== 1 ? "s" : ""}
            </p>
            <Select value={catValue} onValueChange={setCatValue}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona categoría..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setCatOpen(false); setCatValue("") }}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={!catValue || bulkUpdate.isPending}
                onClick={handleCategory}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
