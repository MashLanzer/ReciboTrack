"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useExpenseTemplates, useCreateTemplate, useDeleteTemplate, type ExpenseTemplate } from "@/hooks/use-expense-templates"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"

interface Props {
  onSelect: (template: ExpenseTemplate) => void
  currentFormValues?: {
    merchant: string
    total: string
    category: string
    currency: string
    notes: string
    tags: string
  }
}

export function ExpenseTemplateSelector({ onSelect, currentFormValues }: Props) {
  const { data: templates = [], isLoading } = useExpenseTemplates()
  const createTemplate = useCreateTemplate()
  const deleteTemplate = useDeleteTemplate()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templateIcon, setTemplateIcon] = useState("📌")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function handleCreate() {
    if (!templateName.trim()) {
      toast.error("Ingresa un nombre para la plantilla")
      return
    }
    try {
      await createTemplate.mutateAsync({
        name: templateName.trim(),
        icon: templateIcon || "📌",
        merchant: currentFormValues?.merchant ?? "",
        category: currentFormValues?.category ?? "Otros",
        amount: parseFloat(currentFormValues?.total ?? "0") || 0,
        currency: currentFormValues?.currency ?? "USD",
        account: "personal",
        notes: currentFormValues?.notes ?? "",
        tags: currentFormValues?.tags
          ? currentFormValues.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
      })
      toast.success("Plantilla guardada")
      setDialogOpen(false)
      setTemplateName("")
      setTemplateIcon("📌")
    } catch {
      toast.error("Error al guardar plantilla")
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setDeleteId(id)
    try {
      await deleteTemplate.mutateAsync(id)
      toast.success("Plantilla eliminada")
    } catch {
      toast.error("Error al eliminar plantilla")
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {isLoading && (
          <>
            <Skeleton className="h-8 w-28 rounded-full shrink-0" />
            <Skeleton className="h-8 w-24 rounded-full shrink-0" />
            <Skeleton className="h-8 w-32 rounded-full shrink-0" />
          </>
        )}

        {!isLoading && templates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => onSelect(tpl)}
            className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all shrink-0 active:scale-95"
          >
            <span>{tpl.icon}</span>
            <span>{tpl.name}</span>
            <span className="text-muted-foreground/60">·</span>
            <span>{formatCurrency(tpl.amount, tpl.currency)}</span>
            <span
              role="button"
              tabIndex={0}
              aria-label="Eliminar plantilla"
              onClick={(e) => handleDelete(tpl.id, e)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleDelete(tpl.id, e as unknown as React.MouseEvent) }}
              className="ml-0.5 hidden group-hover:flex items-center justify-center h-4 w-4 rounded-full hover:bg-destructive/20 hover:text-destructive transition-colors"
            >
              {deleteId === tpl.id
                ? <span className="h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
                : <Trash2 className="h-2.5 w-2.5" />}
            </span>
          </button>
        ))}

        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all shrink-0 active:scale-95"
        >
          <Plus className="h-3 w-3" />
          <span>Nuevo</span>
        </button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Nueva plantilla</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Nombre</Label>
              <Input
                id="tpl-name"
                placeholder="Ej: Nafta, Café, Almuerzo…"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-icon">Emoji</Label>
              <Input
                id="tpl-icon"
                placeholder="📌"
                value={templateIcon}
                onChange={(e) => setTemplateIcon(e.target.value)}
                className="text-lg"
                maxLength={4}
              />
            </div>
            {currentFormValues?.merchant && (
              <p className="text-xs text-muted-foreground">
                Se guardará con los valores actuales del formulario.
              </p>
            )}
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={createTemplate.isPending || !templateName.trim()}
            >
              {createTemplate.isPending ? "Guardando…" : "Guardar plantilla"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
