"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useProjects, useRenameProject, type ProjectSummary } from "@/hooks/use-projects"
import { useCategories } from "@/hooks/use-categories"
import { useProjectBudgets, useSetProjectBudget } from "@/hooks/use-project-budgets"
import { DEFAULT_CATEGORIES } from "@/lib/constants"
import { formatCurrency, cn } from "@/lib/utils"
import { format, differenceInDays } from "date-fns"
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
  ArrowLeft,
  Briefcase,
  Receipt,
  ExternalLink,
  Pencil,
  Calendar,
  TrendingUp,
  Wallet,
  AlertTriangle,
  Plus,
} from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { useExpensesPeriod, useAddExpense } from "@/hooks/use-expenses"
import { startOfMonth, subMonths, endOfMonth } from "date-fns"
import type { Expense } from "@/types"

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const now = useMemo(() => new Date(), [])
  const { isLoading } = useExpensesPeriod(startOfMonth(subMonths(now, 5)), endOfMonth(now))
  const { projects, expenses } = useProjects()
  const { data: categories = [] } = useCategories()
  const { data: budgets = {} } = useProjectBudgets()
  const setBudget = useSetProjectBudget()
  const addExpense = useAddExpense()
  const allCats = categories.length > 0 ? categories : DEFAULT_CATEGORIES

  const [selected, setSelected] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<ProjectSummary | null>(null)
  const [budgetTarget, setBudgetTarget] = useState<ProjectSummary | null>(null)
  const [budgetInput, setBudgetInput] = useState("")
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [creatingProject, setCreatingProject] = useState(false)

  const selectedProject = projects.find((p) => p.name === selected)
  const projectExpenses = useMemo(
    () => (selected ? expenses.filter((e) => e.project === selected) : []),
    [selected, expenses]
  )

  async function handleCreateProject() {
    const name = newProjectName.trim()
    if (!name) { toast.error("El nombre del proyecto es obligatorio"); return }
    if (projects.some((p) => p.name === name)) {
      toast.error("Ya existe un proyecto con ese nombre")
      return
    }
    setCreatingProject(true)
    try {
      await addExpense.mutateAsync({
        merchant: name,
        date: new Date(),
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0.01,
        paymentMethod: null,
        reference: null,
        category: "otros",
        currency: "USD",
        notes: "Placeholder de proyecto",
        tags: [],
        receiptImageUrl: null,
        project: name,
      })
      toast.success(`Proyecto "${name}" creado`)
      setNewProjectOpen(false)
      setNewProjectName("")
    } catch {
      toast.error("Error al crear el proyecto")
    } finally {
      setCreatingProject(false)
    }
  }

  return (
    <>
      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        {selected ? (
          <DetailHeader
            project={selectedProject!}
            allCats={allCats}
            onBack={() => setSelected(null)}
            onRename={() => setRenameTarget(selectedProject!)}
          />
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-xl">Proyectos</h1>
                <p className="text-xs text-muted-foreground">
                  {projects.length > 0
                    ? `${projects.length} proyecto${projects.length !== 1 ? "s" : ""} · últimos 6 meses`
                    : "Asigna gastos a proyectos para verlos aquí"}
                </p>
              </div>
            </div>
            <Button onClick={() => { setNewProjectName(""); setNewProjectOpen(true) }} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              Nuevo proyecto
            </Button>
          </div>
        )}

        {/* ── Content ────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : selected ? (
          <DetailView
            project={selectedProject!}
            expenses={projectExpenses}
            allCats={allCats}
            budget={budgets[selectedProject?.name ?? ""] ?? null}
            onSetBudget={() => {
              setBudgetTarget(selectedProject!)
              setBudgetInput(String(budgets[selectedProject?.name ?? ""] ?? ""))
            }}
          />
        ) : (
          <ListView
            projects={projects}
            allCats={allCats}
            budgets={budgets}
            onSelect={setSelected}
            onRename={setRenameTarget}
            onSetBudget={(p) => { setBudgetTarget(p); setBudgetInput(String(budgets[p.name] ?? "")) }}
          />
        )}
      </div>

      {/* ── Rename dialog (outside scroll area) ────────────────────────── */}
      {renameTarget && (
        <RenameDialog
          project={renameTarget}
          onClose={() => setRenameTarget(null)}
          onRenamed={(newName) => {
            if (selected) setSelected(newName)
            setRenameTarget(null)
          }}
        />
      )}

      {/* ── New project dialog ─────────────────────────────────────────── */}
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Nuevo proyecto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Los proyectos se crean al etiquetar gastos. Este acceso rápido crea un gasto placeholder de $0.01 con el nombre del proyecto.
            </p>
            <div>
              <Label className="text-xs mb-1 block">Nombre del proyecto *</Label>
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                placeholder="Mi proyecto, Cliente XYZ..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProjectOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreateProject}
              disabled={creatingProject || !newProjectName.trim()}
            >
              {creatingProject ? "Creando…" : "Crear proyecto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Budget dialog ─────────────────────────────────────────────── */}
      {budgetTarget && (
        <Dialog open onOpenChange={() => setBudgetTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Presupuesto para "{budgetTarget.name}"
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Define un límite de gasto para este proyecto. Deja vacío para eliminar.
              </p>
              <div>
                <Label className="text-xs mb-1 block">Presupuesto (0 = sin límite)</Label>
                <Input
                  type="number" inputMode="decimal"
                  min={0}
                  step={10}
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  placeholder="Sin límite"
                  className="tabular-nums"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBudgetTarget(null)}>Cancelar</Button>
              <Button
                onClick={async () => {
                  const v = parseFloat(budgetInput)
                  try {
                    await setBudget.mutateAsync({
                      projectName: budgetTarget.name,
                      budget: isNaN(v) || v === 0 ? null : v,
                    })
                    toast.success("Presupuesto guardado")
                    setBudgetTarget(null)
                  } catch {
                    toast.error("Error al guardar presupuesto")
                  }
                }}
                disabled={setBudget.isPending}
              >
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

// ─── List view ────────────────────────────────────────────────────────────────

function ListView({
  projects,
  allCats,
  budgets,
  onSelect,
  onRename,
  onSetBudget,
}: {
  projects: ProjectSummary[]
  allCats: { id: string; icon: string; name: string }[]
  budgets: Record<string, number>
  onSelect: (name: string) => void
  onRename: (p: ProjectSummary) => void
  onSetBudget: (p: ProjectSummary) => void
}) {
  const maxTotal = projects[0]?.total ?? 1

  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
          <Briefcase className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold">Sin proyectos todavía</p>
          <p className="text-sm text-muted-foreground max-w-64">
            Al editar un gasto, escribe el nombre del proyecto en el campo correspondiente.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {projects.map((p) => {
        const pct = maxTotal > 0 ? (p.total / maxTotal) * 100 : 0
        const days = differenceInDays(p.lastDate, p.firstDate)
        const catIcons = p.topCategories
          .map(({ catId }) => allCats.find((c) => c.id === catId)?.icon)
          .filter(Boolean) as string[]

        return (
          <button
            key={p.name}
            onClick={() => onSelect(p.name)}
            className="w-full text-left rounded-2xl border p-4 hover:bg-accent/30 transition-colors space-y-3 group"
          >
            <div className="flex items-start justify-between gap-3">
              {/* Left: icon + name + meta */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate leading-tight">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {p.count} gasto{p.count !== 1 ? "s" : ""}
                    </span>
                    {catIcons.length > 0 && (
                      <span className="text-xs">{catIcons.join(" ")}</span>
                    )}
                    {days > 0 && (
                      <span className="text-xs text-muted-foreground">
                        · {days}d
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: total + actions */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums">{formatCurrency(p.total)}</p>
                  {budgets[p.name] && (
                    <p className={cn(
                      "text-[11px] tabular-nums",
                      p.total > budgets[p.name] ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {p.total > budgets[p.name] && "⚠ "}
                      /{formatCurrency(budgets[p.name])}
                    </p>
                  )}
                </div>
                <div className="flex items-center md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(ev) => { ev.stopPropagation(); onSetBudget(p) }}
                    className="p-1 rounded-lg hover:bg-muted transition-all"
                    aria-label="Presupuesto"
                  >
                    <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={(ev) => { ev.stopPropagation(); onRename(p) }}
                    className="p-1 rounded-lg hover:bg-muted transition-all"
                    aria-label="Renombrar proyecto"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>

            {/* Progress bar (vs max project) */}
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/70 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Budget bar */}
            {budgets[p.name] && (
              <div className="space-y-0.5">
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      p.total > budgets[p.name] ? "bg-destructive" : "bg-green-500/70"
                    )}
                    style={{ width: `${Math.min((p.total / budgets[p.name]) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Presupuesto: {Math.round((p.total / budgets[p.name]) * 100)}%
                </p>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Detail header ─────────────────────────────────────────────────────────────

function DetailHeader({
  project,
  allCats,
  onBack,
  onRename,
}: {
  project: ProjectSummary
  allCats: { id: string; icon: string; name: string }[]
  onBack: () => void
  onRename: () => void
}) {
  const router = useRouter()
  if (!project) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-xl truncate">{project.name}</h1>
          <p className="text-xs text-muted-foreground">
            {project.count} gasto{project.count !== 1 ? "s" : ""} · {formatCurrency(project.total)}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRename}
            title="Renombrar proyecto"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Ver en Gastos"
            onClick={() => router.push(`/expenses?q=${encodeURIComponent(project.name)}`)}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail view ──────────────────────────────────────────────────────────────

function DetailView({
  project,
  expenses,
  allCats,
  budget,
  onSetBudget,
}: {
  project: ProjectSummary
  expenses: Expense[]
  allCats: { id: string; icon: string; name: string }[]
  budget: number | null
  onSetBudget: () => void
}) {
  if (!project) return null

  // Category breakdown
  const catTotals = useMemo(() => {
    const map = new Map<string, number>()
    expenses.forEach((e) => {
      map.set(e.category, (map.get(e.category) ?? 0) + e.total)
    })
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([catId, total]) => ({
        catId,
        total,
        cat: allCats.find((c) => c.id === catId),
        pct: project.total > 0 ? (total / project.total) * 100 : 0,
      }))
  }, [expenses, allCats, project.total])

  const days = differenceInDays(project.lastDate, project.firstDate)

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span className="text-xs">Período</span>
            </div>
            <p className="text-sm font-semibold">
              {format(project.firstDate, "d MMM", { locale: es })}
              {days > 0 && ` → ${format(project.lastDate, "d MMM", { locale: es })}`}
            </p>
            {days > 0 && (
              <p className="text-xs text-muted-foreground">{days} días</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-xs">Media por gasto</span>
            </div>
            <p className="text-sm font-semibold tabular-nums">
              {formatCurrency(project.count > 0 ? project.total / project.count : 0)}
            </p>
            <p className="text-xs text-muted-foreground">{project.count} gastos</p>
          </CardContent>
        </Card>
      </div>

      {/* Budget card */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              <span className="text-xs">Presupuesto</span>
            </div>
            <Button size="sm" variant="outline" className="h-6 text-xs gap-1 px-2" onClick={onSetBudget}>
              <Pencil className="h-2.5 w-2.5" />
              {budget ? "Cambiar" : "Definir"}
            </Button>
          </div>
          {budget ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className={cn(
                  "font-semibold tabular-nums",
                  project.total > budget ? "text-destructive" : ""
                )}>
                  {formatCurrency(project.total)} / {formatCurrency(budget)}
                </span>
                <span className={cn(
                  "tabular-nums",
                  project.total > budget ? "text-destructive font-medium" : "text-muted-foreground"
                )}>
                  {Math.round((project.total / budget) * 100)}%
                  {project.total > budget && " ⚠"}
                </span>
              </div>
              <Progress
                value={Math.min((project.total / budget) * 100, 100)}
                className="h-2"
              />
              {project.total > budget && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Excedido por {formatCurrency(project.total - budget)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sin presupuesto definido</p>
          )}
        </CardContent>
      </Card>

      {/* Category breakdown */}
      {catTotals.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Por categoría
            </p>
            <div className="space-y-2.5">
              {catTotals.map(({ catId, total, cat, pct }) => (
                <div key={catId} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-base leading-none shrink-0">{cat?.icon ?? "📦"}</span>
                      <span className="text-sm truncate">{cat?.name ?? catId}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0">
                      {formatCurrency(total)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground w-8 text-right">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expense list */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
          Gastos ({expenses.length})
        </p>
        {expenses.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sin gastos en este período</p>
          </div>
        ) : (
          expenses.map((e) => {
            const cat = allCats.find((c) => c.id === e.category)
            return (
              <div
                key={e.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-l-[3px] hover:bg-muted/30 transition-colors"
                style={{ borderLeftColor: (cat as { color?: string })?.color ?? "hsl(var(--border))" }}
              >
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                  style={{ backgroundColor: `${(cat as { color?: string })?.color ?? "#6b7280"}20` }}
                >
                  {cat?.icon ?? "📦"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.merchant}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(e.date.toDate(), "d MMM yyyy", { locale: es })}
                    {e.notes ? ` · ${e.notes}` : ""}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums shrink-0 text-destructive">
                  -{formatCurrency(e.total, e.currency)}
                </p>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Rename dialog ────────────────────────────────────────────────────────────

function RenameDialog({
  project,
  onClose,
  onRenamed,
}: {
  project: ProjectSummary
  onClose: () => void
  onRenamed: (newName: string) => void
}) {
  const [name, setName] = useState(project.name)
  const rename = useRenameProject()

  async function handleSave() {
    if (!name.trim() || name.trim() === project.name) {
      onClose()
      return
    }
    try {
      await rename.mutateAsync({ expenseIds: project.expenseIds, newName: name.trim() })
      toast.success(`Proyecto renombrado a "${name.trim()}"`)
      onRenamed(name.trim())
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al renombrar")
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Renombrar proyecto</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm text-muted-foreground mb-3">
            Se actualizarán {project.count} gasto{project.count !== 1 ? "s" : ""}.
          </p>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Nombre del proyecto"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={rename.isPending || !name.trim()}
          >
            {rename.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
