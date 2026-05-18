"use client"

import { useState } from "react"
import {
  useGroupFolders,
  useCreateGroupFolder,
  useUpdateGroupFolder,
  useDeleteGroupFolder,
  type GroupFolder,
} from "@/hooks/use-group-folders"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, Folder } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface GroupFoldersProps {
  groupId: string
}

const FOLDER_EMOJIS = ["📁", "📂", "📋", "📌", "🗂️", "📎", "📝", "🔖"]

function FolderCard({
  folder,
  onEdit,
  onDelete,
}: {
  folder: GroupFolder
  onEdit: (f: GroupFolder) => void
  onDelete: (f: GroupFolder) => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3 group hover:bg-accent/30 transition-colors">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl shrink-0">
        {folder.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{folder.name}</p>
        {folder.description && (
          <p className="text-xs text-muted-foreground truncate">{folder.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(folder)}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(folder)}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

interface FolderFormState {
  name: string
  emoji: string
  description: string
}

function emptyForm(): FolderFormState {
  return { name: "", emoji: "📁", description: "" }
}

export function GroupFolders({ groupId }: GroupFoldersProps) {
  const { data: folders = [], isLoading } = useGroupFolders(groupId)
  const create = useCreateGroupFolder()
  const update = useUpdateGroupFolder()
  const remove = useDeleteGroupFolder()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GroupFolder | null>(null)
  const [form, setForm] = useState<FolderFormState>(emptyForm())

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setOpen(true)
  }

  function openEdit(folder: GroupFolder) {
    setEditing(folder)
    setForm({ name: folder.name, emoji: folder.emoji, description: folder.description ?? "" })
    setOpen(true)
  }

  async function handleDelete(folder: GroupFolder) {
    try {
      await remove.mutateAsync({ groupId, folderId: folder.id })
      toast.success("Carpeta eliminada")
    } catch {
      toast.error("Error al eliminar carpeta")
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("El nombre es requerido"); return }
    try {
      if (editing) {
        await update.mutateAsync({
          groupId,
          folderId: editing.id,
          name: form.name.trim(),
          emoji: form.emoji,
          description: form.description.trim() || undefined,
        })
        toast.success("Carpeta actualizada")
      } else {
        await create.mutateAsync({
          groupId,
          name: form.name.trim(),
          emoji: form.emoji,
          description: form.description.trim() || undefined,
        })
        toast.success("Carpeta creada")
      }
      setOpen(false)
      setForm(emptyForm())
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido"
      toast.error("Error al guardar carpeta", { description: msg })
      console.error("[GroupFolders]", err)
    }
  }

  if (isLoading) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Carpetas del grupo</p>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          Nueva carpeta
        </Button>
      </div>

      {folders.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <Folder className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">Sin carpetas todavía</p>
          <p className="text-xs text-muted-foreground mt-1">
            Organiza los documentos del grupo en carpetas
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {folders.map((f) => (
            <FolderCard key={f.id} folder={f} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!o) setOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar carpeta" : "Nueva carpeta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1 block">Icono</Label>
              <div className="flex flex-wrap gap-2">
                {FOLDER_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                    className={`text-xl p-1.5 rounded-lg border transition-colors ${
                      form.emoji === e
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Nombre *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej. Facturas, Contratos..."
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Descripción (opcional)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Breve descripción..."
                className="h-8 text-sm"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleSave}
              disabled={create.isPending || update.isPending}
            >
              {editing ? "Guardar cambios" : "Crear carpeta"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
