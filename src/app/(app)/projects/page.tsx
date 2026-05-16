"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useProjects, useRenameProject, type ProjectSummary } from "@/hooks/use-projects"
import { useCategories } from "@/hooks/use-categories"
import { DEFAULT_CATEGORIES } from "@/lib/constants"
import { formatCurrency, cn } from "@/lib/utils"
import { format, differenceInDays } from "date-fns"
import { es } from "date-fns/locale"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
} from "lucide-react"
import { toast } from "sonner"
import type { Expense } from "@/types"

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { projects, expenses } = useProjects()
  const { data: categories = [] } = useCategories()
  const allCats = categories.length > 0 ? categories : DEFAULT_CATEGORIES

  const [selected, setSelected] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<ProjectSummary | null>(null)

  const selectedProject = projects.find((p) => p.name === selected)
  const projectExpenses = useMemo(
    () => (selected ? expenses.filter((e) => e.project === selected) : []),
    [selected, expenses]
  )

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
          <div>
            <h1 className="font-serif text-2xl">Clientes y Proyectos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {projects.length > 0
                ? `${projects.length} proyecto${projects.length !== 1 ? "s" : ""} · últimos 6 meses`
                : "Asigna gastos a proyectos para verlos aquí"}
            </p>
          </div>
        )}

        {/* ── Content ────────────────────────────────────────────────────── */}
        {selected ? (
          <DetailView
            project={selectedProject!}
            expenses={projectExpenses}
            allCats={allCats}
          />
        ) : (
          <ListView
            projects={projects}
            allCats={allCats}
            onSelect={setSelected}
            onRename={setRenameTarget}
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
    </>
  )
}

// ─── List view ────────────────────────────────────────────────────────────────

function ListView({
  projects,
  allCats,
  onSelect,
  onRename,
}: {
  projects: ProjectSummary[]
  allCats: { id: string; icon: string; name: string }[]
  onSelect: (name: string) => void
  onRename: (p: ProjectSummary) => void
}) {
  const maxTotal = projects[0]?.total ?? 1

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
          <Briefcase className="h-8 w-8 text-muted-foreground opacity-40" />
        </div>
        <div>
          <p className="font-semibold">Sin proyectos todavía</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Al editar un gasto, escribe el nombre del cliente o proyecto en el campo correspondiente.
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

              {/* Right: total + rename */}
              <div className="flex items-center gap-2 shrink-0">
                <p className="text-lg font-bold tabular-nums">{formatCurrency(p.total)}</p>
                <button
                  onClick={(ev) => { ev.stopPropagation(); onRename(p) }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-muted transition-all"
                  aria-label="Renombrar proyecto"
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/70 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
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
}: {
  project: ProjectSummary
  expenses: Expense[]
  allCats: { id: string; icon: string; name: string }[]
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

      {/* Category breakdown */}
      {catTotals.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
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
                    <span className="text-[10px] text-muted-foreground w-8 text-right">
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
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground px-1">
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
                className="flex items-center gap-3 p-3 rounded-xl border"
              >
                <span className="text-xl leading-none shrink-0">{cat?.icon ?? "📦"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.merchant}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(e.date.toDate(), "d MMM yyyy", { locale: es })}
                    {e.notes ? ` · ${e.notes}` : ""}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums shrink-0">
                  {formatCurrency(e.total, e.currency)}
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
