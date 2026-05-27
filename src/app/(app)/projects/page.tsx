"use client"

import { useState, useMemo } from "react"
import {
  useProjects,
  useProjectDetail,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
} from "@/hooks/use-projects"
import { useClients } from "@/hooks/use-clients"
import { useCategories } from "@/hooks/use-categories"
import { useAddExpense } from "@/hooks/use-expenses"
import { DEFAULT_CATEGORIES } from "@/lib/constants"
import { formatCurrency, cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowLeft,
  Briefcase,
  Receipt,
  Pencil,
  Wallet,
  Plus,
  Trash2,
  Archive,
  User,
  FileText,
  FileDown,
  Share2,
} from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { useOpenInvoice } from "@/hooks/use-export"
import type { Project, ProjectInput } from "@/types"

// ─── Preset colors ────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
]

// ─── Status helpers ───────────────────────────────────────────────────────────

type StatusFilter = "active" | "all" | "archived"

function statusLabel(s: Project["status"]) {
  if (s === "active") return "Activo"
  if (s === "completed") return "Completado"
  return "Archivado"
}

function statusVariant(s: Project["status"]): "default" | "secondary" | "outline" {
  if (s === "active") return "default"
  if (s === "completed") return "secondary"
  return "outline"
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)

  const apiStatus = statusFilter === "active" ? undefined : statusFilter
  const { data: projects = [], isLoading } = useProjects(apiStatus)

  return (
    <>
      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-5">
        {selectedId ? (
          <DetailSection
            id={selectedId}
            onBack={() => setSelectedId(null)}
            onEdit={(p) => setEditProject(p)}
          />
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-bold text-xl">Proyectos</h1>
                  <p className="text-xs text-muted-foreground">
                    {projects.length > 0
                      ? `${projects.length} proyecto${projects.length !== 1 ? "s" : ""}`
                      : "Sin proyectos todavía"}
                  </p>
                </div>
              </div>
              <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
                <Plus className="h-4 w-4" />
                Nuevo proyecto
              </Button>
            </div>

            {/* Status filter */}
            <div className="flex gap-2">
              {(["active", "all", "archived"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full border transition-colors",
                    statusFilter === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-accent"
                  )}
                >
                  {s === "active" ? "Activos" : s === "all" ? "Todos" : "Archivados"}
                </button>
              ))}
            </div>

            {/* List */}
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="rounded-xl border p-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-lg" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                      <Skeleton className="h-5 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                  <Briefcase className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">Sin proyectos</p>
                  <p className="text-sm text-muted-foreground max-w-64">
                    Crea tu primer proyecto para gestionar gastos por cliente o trabajo.
                  </p>
                </div>
                <Button onClick={() => setCreateOpen(true)} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nuevo proyecto
                </Button>
              </div>
            ) : (
              <ProjectList projects={projects} onSelect={setSelectedId} />
            )}
          </>
        )}
      </div>

      {/* Create dialog */}
      <ProjectFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onDone={() => setCreateOpen(false)}
      />

      {/* Edit dialog */}
      {editProject && (
        <ProjectFormDialog
          open={!!editProject}
          onOpenChange={(open) => { if (!open) setEditProject(null) }}
          project={editProject}
          onDone={() => setEditProject(null)}
        />
      )}
    </>
  )
}

// ─── Project list ─────────────────────────────────────────────────────────────

function ProjectList({
  projects,
  onSelect,
}: {
  projects: Project[]
  onSelect: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      {projects.map((p, i) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className="stagger-item w-full text-left rounded-2xl border p-4 hover:bg-accent/30 hover:shadow-sm transition-all duration-150 space-y-3 group"
          style={{ "--i": i } as React.CSSProperties}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Color dot */}
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${p.color}20` }}
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate leading-tight">{p.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {p.clientName && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {p.clientName}
                    </span>
                  )}
                  {p.description && (
                    <span className="text-xs text-muted-foreground truncate max-w-32">
                      {p.description}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {p.budget && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatCurrency(p.budget, p.currency)}
                </span>
              )}
              <Badge variant={statusVariant(p.status)} className="text-xs">
                {statusLabel(p.status)}
              </Badge>
            </div>
          </div>
          {p.budget && (
            <div className="space-y-1">
              <Progress value={0} className="h-1.5" />
              <p className="text-xs text-muted-foreground">
                Presupuesto: {formatCurrency(p.budget, p.currency)}
              </p>
            </div>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Detail section ───────────────────────────────────────────────────────────

function DetailSection({
  id,
  onBack,
  onEdit,
}: {
  id: string
  onBack: () => void
  onEdit: (p: Project) => void
}) {
  const { data, isLoading } = useProjectDetail(id)
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const { data: categories = [] } = useCategories()
  const allCats = categories.length > 0 ? categories : DEFAULT_CATEGORIES
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const openInvoice = useOpenInvoice()

  async function handleShare(projectId: string) {
    setSharing(true)
    try {
      const res = await apiFetch("/api/invoices/share", {
        method: "POST",
        body: JSON.stringify({ projectId, expiresInDays: 30 }),
      })
      const json = await res.json() as { shareUrl?: string; error?: string }
      if (!res.ok || !json.shareUrl) throw new Error(json.error ?? "Error")
      await navigator.clipboard.writeText(json.shareUrl)
      toast.success("Link copiado · válido por 30 días")
    } catch {
      toast.error("Error al generar el link")
    } finally {
      setSharing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <p className="text-sm">Proyecto no encontrado</p>
        <Button variant="ghost" className="mt-2" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
      </div>
    )
  }

  const { project, expenses } = data
  const total = expenses.reduce((s, e) => s + (e.total as number), 0)

  async function handleArchive() {
    const newStatus = project.status === "archived" ? "active" : "archived"
    try {
      await updateProject.mutateAsync({ id: project.id, status: newStatus })
      toast.success(newStatus === "archived" ? "Proyecto archivado" : "Proyecto reactivado")
    } catch {
      toast.error("Error al actualizar el proyecto")
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar el proyecto "${project.name}"? Los gastos asociados quedarán sin proyecto.`)) return
    try {
      await deleteProject.mutateAsync(project.id)
      toast.success("Proyecto eliminado")
      onBack()
    } catch {
      toast.error("Error al eliminar el proyecto")
    }
  }

  const budgetPct = project.budget && total > 0 ? Math.min((total / project.budget) * 100, 100) : 0
  const overBudget = project.budget ? total > project.budget : false

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${project.color}20` }}
        >
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: project.color }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-xl truncate">{project.name}</h1>
          {project.clientName && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              {project.clientName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant={statusVariant(project.status)}>{statusLabel(project.status)}</Badge>
          <Button variant="ghost" size="icon" onClick={() => onEdit(project)} title="Editar proyecto">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleArchive}
            title={project.status === "archived" ? "Reactivar" : "Archivar"}
          >
            <Archive className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            title="Eliminar proyecto"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Info card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {project.description && (
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">{project.description}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Gastos del proyecto</p>
              <p className="font-bold tabular-nums">{formatCurrency(total, project.currency)}</p>
            </div>
            {project.budget && (
              <div>
                <p className="text-xs text-muted-foreground">Presupuesto</p>
                <p className={cn("font-bold tabular-nums", overBudget && "text-destructive")}>
                  {formatCurrency(project.budget, project.currency)}
                </p>
              </div>
            )}
          </div>
          {project.budget && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className={cn(overBudget ? "text-destructive font-medium" : "text-muted-foreground")}>
                  {Math.round((total / project.budget) * 100)}% usado
                </span>
                {overBudget && (
                  <span className="text-destructive font-medium">
                    Excedido +{formatCurrency(total - project.budget, project.currency)}
                  </span>
                )}
              </div>
              <Progress
                value={budgetPct}
                className={cn("h-2", overBudget && "[&>div]:bg-destructive")}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          className="flex-1 gap-2"
          variant="outline"
          onClick={() => setAddExpenseOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Añadir gasto al proyecto
        </Button>
        {project.clientId && (
          <Button
            variant="outline"
            className="gap-2 shrink-0"
            onClick={() => openInvoice(project.id)}
          >
            <FileDown className="h-4 w-4" />
            Generar Factura
          </Button>
        )}
        {project.clientId && (
          <Button
            variant="outline"
            className="gap-2 shrink-0"
            onClick={() => handleShare(project.id)}
            disabled={sharing}
          >
            <Share2 className="h-4 w-4" />
            Compartir factura
          </Button>
        )}
      </div>

      {/* Expense list */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
          Gastos ({expenses.length})
        </p>
        {expenses.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sin gastos en este proyecto</p>
            <p className="text-xs mt-1">Usa el botón de arriba para añadir el primer gasto.</p>
          </div>
        ) : (
          expenses.map((e) => {
            const cat = allCats.find((c) => c.id === e.category)
            const dateStr = e.date
              ? format(new Date(e.date as unknown as string), "d MMM yyyy", { locale: es })
              : ""
            return (
              <div
                key={e.id as string}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border hover:bg-muted/30 transition-colors"
              >
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                  style={{ backgroundColor: `${(cat as { color?: string })?.color ?? "#6b7280"}20` }}
                >
                  {cat?.icon ?? "📦"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.merchant as string}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateStr}
                    {(e.notes as string) ? ` · ${e.notes}` : ""}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums shrink-0 text-destructive">
                  -{formatCurrency(e.total as number, e.currency as string)}
                </p>
              </div>
            )
          })
        )}
      </div>

      {/* Add expense dialog */}
      <AddExpenseDialog
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        projectId={project.id}
        projectName={project.name}
        allCats={allCats}
        onDone={() => setAddExpenseOpen(false)}
      />
    </div>
  )
}

// ─── Add expense dialog ───────────────────────────────────────────────────────

function AddExpenseDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  allCats,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  projectId: string
  projectName: string
  allCats: { id: string; icon: string; name: string }[]
  onDone: () => void
}) {
  const addExpense = useAddExpense()
  const [merchant, setMerchant] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("otros")
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!merchant.trim()) { toast.error("El nombre del comercio es obligatorio"); return }
    const total = parseFloat(amount)
    if (isNaN(total) || total <= 0) { toast.error("El importe debe ser mayor a 0"); return }

    setSaving(true)
    try {
      await addExpense.mutateAsync({
        merchant: merchant.trim(),
        date: new Date(date + "T12:00:00"),
        items: [],
        subtotal: total,
        tax: 0,
        total,
        paymentMethod: null,
        reference: null,
        category,
        currency: "USD",
        notes: notes.trim(),
        tags: [],
        receiptImageUrl: null,
        projectId,
        project: projectName,
      })
      toast.success("Gasto añadido al proyecto")
      setMerchant("")
      setAmount("")
      setNotes("")
      setCategory("otros")
      setDate(format(new Date(), "yyyy-MM-dd"))
      onDone()
    } catch {
      toast.error("Error al añadir el gasto")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Añadir gasto al proyecto
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs mb-1 block">Comercio / descripción *</Label>
            <Input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Nombre del comercio"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Importe *</Label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="tabular-nums"
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Categoría</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
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
          <div>
            <Label className="text-xs mb-1 block">Fecha</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Notas</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas opcionales…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !merchant.trim() || !amount}>
            {saving ? "Guardando…" : "Añadir gasto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Project form dialog ──────────────────────────────────────────────────────

function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  project?: Project
  onDone: () => void
}) {
  const { data: clients = [] } = useClients()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()

  const isEdit = !!project

  const [name, setName] = useState(project?.name ?? "")
  const [clientId, setClientId] = useState<string>(project?.clientId ?? "__none__")
  const [description, setDescription] = useState(project?.description ?? "")
  const [budget, setBudget] = useState(project?.budget != null ? String(project.budget) : "")
  const [color, setColor] = useState(project?.color ?? PRESET_COLORS[0])
  const [status, setStatus] = useState<"active" | "completed">(
    project?.status === "completed" ? "completed" : "active"
  )
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!name.trim()) { toast.error("El nombre del proyecto es obligatorio"); return }

    const input: ProjectInput = {
      name: name.trim(),
      clientId: clientId === "__none__" ? null : clientId,
      description: description.trim() || null,
      budget: budget ? parseFloat(budget) || null : null,
      currency: "USD",
      status,
      color,
    }

    setSaving(true)
    try {
      if (isEdit && project) {
        await updateProject.mutateAsync({ id: project.id, ...input })
        toast.success("Proyecto actualizado")
      } else {
        await createProject.mutateAsync(input)
        toast.success("Proyecto creado")
      }
      onDone()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el proyecto")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            {isEdit ? "Editar proyecto" : "Nuevo proyecto"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {/* Name */}
          <div>
            <Label className="text-xs mb-1 block">Nombre *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Nombre del proyecto"
              autoFocus
            />
          </div>

          {/* Client */}
          <div>
            <Label className="text-xs mb-1 block">Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Sin cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin cliente</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs mb-1 block">Descripción</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción opcional…"
            />
          </div>

          {/* Budget */}
          <div>
            <Label className="text-xs mb-1 block flex items-center gap-1">
              <Wallet className="h-3 w-3" />
              Presupuesto
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step={10}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Sin límite"
              className="tabular-nums"
            />
          </div>

          {/* Status */}
          <div>
            <Label className="text-xs mb-1 block">Estado</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "active" | "completed")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Color */}
          <div>
            <Label className="text-xs mb-1 block">Color</Label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform",
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear proyecto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
