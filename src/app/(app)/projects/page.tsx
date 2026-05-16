"use client"

import { useState } from "react"
import { useProjects } from "@/hooks/use-projects"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Briefcase, Receipt } from "lucide-react"
import { cn } from "@/lib/utils"

export default function ProjectsPage() {
  const { projects, expenses } = useProjects()
  const [selected, setSelected] = useState<string | null>(null)

  const maxTotal = projects[0]?.total ?? 1

  const projectExpenses = selected
    ? expenses.filter((e) => e.project === selected)
    : []

  if (selected) {
    const proj = projects.find((p) => p.name === selected)
    return (
      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-serif text-xl">{selected}</h1>
            <p className="text-xs text-muted-foreground">
              {proj?.count} gasto{proj?.count !== 1 ? "s" : ""} · {formatCurrency(proj?.total ?? 0)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {projectExpenses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin gastos en este proyecto</p>
            </div>
          ) : projectExpenses.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl border">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{e.merchant}</p>
                <p className="text-xs text-muted-foreground">
                  {format(e.date.toDate(), "d MMM yyyy", { locale: es })}
                  {e.category ? ` · ${e.category}` : ""}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(e.total, e.currency)}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="font-serif text-2xl">Clientes y Proyectos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {projects.length} proyecto{projects.length !== 1 ? "s" : ""} en los últimos 6 meses
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
            <Briefcase className="h-8 w-8 text-muted-foreground opacity-50" />
          </div>
          <div>
            <p className="font-semibold">Sin proyectos todavía</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Asigna gastos a clientes o proyectos desde el formulario de edición de gasto.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => {
            const pct = maxTotal > 0 ? (p.total / maxTotal) * 100 : 0
            return (
              <button
                key={p.name}
                onClick={() => setSelected(p.name)}
                className="w-full text-left rounded-xl border p-4 hover:bg-accent/30 transition-colors space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Briefcase className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.count} gasto{p.count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <p className="text-lg font-bold tabular-nums shrink-0">{formatCurrency(p.total)}</p>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
