"use client"

import { useState } from "react"
import {
  useGroupChecklists,
  useCreateGroupChecklist,
  useToggleChecklistItem,
  useDeleteGroupChecklist,
  useAddChecklistItem,
  type GroupChecklist,
} from "@/hooks/use-group-checklists"
import { toast } from "sonner"
import { Plus, Trash2, CheckSquare, Square, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface GroupChecklistsProps {
  groupId: string
}

function ChecklistCard({
  checklist,
  groupId,
  onDelete,
}: {
  checklist: GroupChecklist
  groupId: string
  onDelete: () => void
}) {
  const toggle = useToggleChecklistItem()
  const addItem = useAddChecklistItem()
  const [expanded, setExpanded] = useState(true)
  const [newItemText, setNewItemText] = useState("")
  const [addingItem, setAddingItem] = useState(false)

  const doneCount = checklist.items.filter((i) => i.done).length
  const progress = checklist.items.length > 0
    ? Math.round((doneCount / checklist.items.length) * 100)
    : 0

  async function handleToggle(itemId: string, currentDone: boolean) {
    try {
      await toggle.mutateAsync({
        groupId,
        checklistId: checklist.id,
        itemId,
        currentItems: checklist.items,
        done: !currentDone,
      })
    } catch {
      toast.error("Error al actualizar")
    }
  }

  async function handleAddItem() {
    if (!newItemText.trim()) return
    try {
      await addItem.mutateAsync({
        groupId,
        checklistId: checklist.id,
        text: newItemText,
        currentItems: checklist.items,
      })
      setNewItemText("")
      setAddingItem(false)
    } catch {
      toast.error("Error al añadir elemento")
    }
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <CheckSquare className="h-4 w-4 text-primary shrink-0" />
          <p className="font-semibold text-sm truncate">{checklist.title}</p>
          <span className="text-xs text-muted-foreground shrink-0">
            {doneCount}/{checklist.items.length}
          </span>
          {expanded
            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        </button>
        <button
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted mx-4 rounded-full overflow-hidden mb-1">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            progress === 100 ? "bg-green-500" : "bg-primary"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {expanded && (
        <div className="px-4 pb-3 space-y-1.5">
          {checklist.items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleToggle(item.id, item.done)}
              className="flex items-start gap-2.5 w-full text-left group py-0.5"
            >
              {item.done
                ? <CheckSquare className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                : <Square className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0 mt-0.5 transition-colors" />}
              <span className={cn(
                "text-sm leading-relaxed",
                item.done && "line-through text-muted-foreground"
              )}>
                {item.text}
              </span>
              {item.done && item.doneByName && (
                <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                  {item.doneByName}
                </span>
              )}
            </button>
          ))}

          {addingItem ? (
            <div className="flex gap-2 items-center mt-2">
              <Input
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); if (e.key === "Escape") setAddingItem(false) }}
                placeholder="Nuevo elemento..."
                className="h-7 text-xs flex-1"
                autoFocus
              />
              <Button size="sm" className="h-7 text-xs" onClick={handleAddItem} disabled={addItem.isPending}>
                Añadir
              </Button>
              <button
                onClick={() => { setAddingItem(false); setNewItemText("") }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingItem(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Añadir elemento
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function GroupChecklists({ groupId }: GroupChecklistsProps) {
  const { data: checklists = [], isLoading } = useGroupChecklists(groupId)
  const create = useCreateGroupChecklist()
  const remove = useDeleteGroupChecklist()

  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [itemLines, setItemLines] = useState("") // one per line

  async function handleCreate() {
    if (!title.trim()) { toast.error("El título es requerido"); return }
    const items = itemLines.split("\n").filter((l) => l.trim())
    try {
      await create.mutateAsync({ groupId, title: title.trim(), items })
      toast.success("Checklist creado")
      setTitle("")
      setItemLines("")
      setOpen(false)
    } catch {
      toast.error("Error al crear checklist")
    }
  }

  async function handleDelete(checklistId: string) {
    try {
      await remove.mutateAsync({ groupId, checklistId })
      toast.success("Checklist eliminado")
    } catch {
      toast.error("Error al eliminar")
    }
  }

  if (isLoading) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Checklists colaborativos</p>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Nuevo
        </Button>
      </div>

      {checklists.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-muted/20 p-6 text-center">
          <CheckSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">Sin checklists todavía</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crea listas de tareas colaborativas para el grupo
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {checklists.map((cl) => (
            <ChecklistCard
              key={cl.id}
              checklist={cl}
              groupId={groupId}
              onDelete={() => handleDelete(cl.id)}
            />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!o) setOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo checklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1 block">Título *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Cosas para comprar..."
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Elementos (uno por línea)</Label>
              <textarea
                value={itemLines}
                onChange={(e) => setItemLines(e.target.value)}
                placeholder={"Leche\nPan\nHuevos"}
                rows={5}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={create.isPending}>
              Crear checklist
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
