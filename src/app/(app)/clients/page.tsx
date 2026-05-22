"use client"

import { useState } from "react"
import {
  useClients,
  useAddClient,
  useUpdateClient,
  useDeleteClient,
} from "@/hooks/use-clients"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, UserCheck, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Client, ClientInput } from "@/types"

const PRESET_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#3b82f6",
  "#ef4444",
]

interface ClientForm {
  name: string
  email: string
  phone: string
  notes: string
  color: string
  isActive: boolean
}

const EMPTY_FORM: ClientForm = {
  name: "",
  email: "",
  phone: "",
  notes: "",
  color: PRESET_COLORS[0],
  isActive: true,
}

export default function ClientsPage() {
  const { data: clients = [], isLoading } = useClients()
  const addClient = useAddClient()
  const updateClient = useUpdateClient()
  const deleteClient = useDeleteClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(c: Client) {
    setEditingId(c.id)
    setForm({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      notes: c.notes ?? "",
      color: c.color,
      isActive: c.isActive,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("El nombre es obligatorio"); return }

    // #17 — Validar formato de email si se proporcionó
    if (form.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(form.email.trim())) {
        toast.error("El email no tiene un formato válido")
        return
      }
    }

    // #27 — Asegurar que el color sea uno de los predefinidos; si no, usar el primero
    const safeColor = PRESET_COLORS.includes(form.color) ? form.color : PRESET_COLORS[0]

    setSaving(true)
    try {
      const input: ClientInput = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        notes: form.notes.trim() || undefined,
        color: safeColor,
        isActive: form.isActive,
      }

      if (editingId) {
        await updateClient.mutateAsync({ id: editingId, input })
        toast.success("Cliente actualizado")
      } else {
        await addClient.mutateAsync(input)
        toast.success("Cliente creado")
      }
      setDialogOpen(false)
    } catch {
      toast.error("Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c: Client) {
    setDeleteTarget(c)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteClient.mutateAsync(deleteTarget.id)
      toast.success("Cliente eliminado")
    } catch {
      toast.error("Error al eliminar")
    }
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title={`¿Eliminar a "${deleteTarget?.name}"?`}
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clients.length > 0
              ? `${clients.length} cliente${clients.length !== 1 ? "s" : ""}`
              : "Gestiona tus clientes"}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && clients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <UserCheck className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Sin clientes todavía</p>
            <p className="text-sm text-muted-foreground mt-1">
              Agrega tus clientes para asociarles gastos y proyectos.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Crear el primero
          </Button>
        </div>
      )}

      {/* Cards list */}
      {!isLoading && clients.length > 0 && (
        <div className="space-y-3">
          {clients.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border bg-card p-4 flex items-center gap-4"
            >
              {/* Color dot + initial */}
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                style={{ backgroundColor: c.color }}
              >
                {c.name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold truncate">{c.name}</p>
                  {!c.isActive && (
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border rounded px-1">
                      inactivo
                    </span>
                  )}
                </div>
                {(c.email || c.phone) && (
                  <p className="text-sm text-muted-foreground truncate">
                    {[c.email, c.phone].filter(Boolean).join(" · ")}
                  </p>
                )}
                {c.notes && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{c.notes}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => openEdit(c)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(c)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar cliente" : "Nuevo cliente"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input
                placeholder="Acme Corp, Juan Pérez..."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input
                  type="tel"
                  placeholder="+1 555 000 0000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input
                placeholder="Información adicional..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color })}
                    className={cn(
                      "h-8 w-8 rounded-full transition-all",
                      form.color === color
                        ? "ring-2 ring-offset-2 ring-foreground scale-110"
                        : "hover:scale-105"
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={color}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4 rounded"
              />
              <Label htmlFor="isActive" className="cursor-pointer">Cliente activo</Label>
            </div>

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
