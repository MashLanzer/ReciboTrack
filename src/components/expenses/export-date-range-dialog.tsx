"use client"

import { useState } from "react"
import { format as fmtDate, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns"
import { toast } from "sonner"
import { FileDown, Sheet, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { exportToCSV, exportToPDF } from "./export-utils"
import { useUpdateUserSettings } from "@/hooks/use-user-settings"
import type { Expense, CategoryDoc } from "@/types"

interface ExportDateRangeDialogProps {
  open: boolean
  onClose: () => void
  expenses: Expense[]
  categories: CategoryDoc[]
}

const PRESETS = [
  { key: "this-month", label: "Este mes" },
  { key: "last-month", label: "Mes pasado" },
  { key: "last-3-months", label: "Últimos 3 meses" },
  { key: "all", label: "Todo" },
] as const

type PresetKey = typeof PRESETS[number]["key"]

function getPresetRange(key: PresetKey): { from: string; to: string } | { from: ""; to: "" } {
  const now = new Date()
  switch (key) {
    case "this-month":
      return {
        from: fmtDate(startOfMonth(now), "yyyy-MM-dd"),
        to: fmtDate(endOfMonth(now), "yyyy-MM-dd"),
      }
    case "last-month": {
      const prev = subMonths(now, 1)
      return {
        from: fmtDate(startOfMonth(prev), "yyyy-MM-dd"),
        to: fmtDate(endOfMonth(prev), "yyyy-MM-dd"),
      }
    }
    case "last-3-months":
      return {
        from: fmtDate(subDays(now, 90), "yyyy-MM-dd"),
        to: fmtDate(now, "yyyy-MM-dd"),
      }
    case "all":
      return { from: "", to: "" }
  }
}

export function ExportDateRangeDialog({ open, onClose, expenses, categories }: ExportDateRangeDialogProps) {
  const updateSettings = useUpdateUserSettings()
  const now = new Date()
  const [from, setFrom] = useState(fmtDate(startOfMonth(now), "yyyy-MM-dd"))
  const [to, setTo] = useState(fmtDate(endOfMonth(now), "yyyy-MM-dd"))
  const [activePreset, setActivePreset] = useState<PresetKey>("this-month")

  function applyPreset(key: PresetKey) {
    setActivePreset(key)
    const range = getPresetRange(key)
    setFrom(range.from)
    setTo(range.to)
  }

  function getFilteredExpenses(): Expense[] {
    if (!from && !to) return expenses

    return expenses.filter((e) => {
      const date = e.date.toDate()
      const afterFrom = !from || date >= new Date(from + "T00:00:00")
      const beforeTo = !to || date <= new Date(to + "T23:59:59")
      return afterFrom && beforeTo
    })
  }

  async function handleCSV() {
    const filtered = getFilteredExpenses()
    if (filtered.length === 0) {
      toast.error("Sin gastos en el rango seleccionado")
      return
    }
    const tid = toast.loading("Generando CSV...")
    await new Promise((r) => setTimeout(r, 30))
    exportToCSV(filtered, {
      start: from ? new Date(from + "T00:00:00") : undefined,
      end: to ? new Date(to + "T23:59:59") : undefined,
    })
    toast.dismiss(tid)
    toast.success(`CSV exportado — ${filtered.length} gastos`)
    onClose()
  }

  async function handlePDF() {
    const filtered = getFilteredExpenses()
    if (filtered.length === 0) {
      toast.error("Sin gastos en el rango seleccionado")
      return
    }
    const tid = toast.loading("Generando PDF...")
    await exportToPDF(filtered, categories, {
      start: from ? new Date(from + "T00:00:00") : undefined,
      end: to ? new Date(to + "T23:59:59") : undefined,
    }, () => { void updateSettings.mutate({ hasExportedPDF: true }) })
    toast.dismiss(tid)
    toast.success(`PDF exportado — ${filtered.length} gastos`)
    onClose()
  }

  const filtered = getFilteredExpenses()

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-4 w-4" />
            Exportar gastos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Presets */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Período</p>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`text-xs px-3 py-2 rounded-lg border transition-colors text-left ${
                    activePreset === key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-accent border-border"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date range */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Rango personalizado</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-12 shrink-0">Desde</label>
                <Input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => { setFrom(e.target.value); setActivePreset("all") }}
                  className="h-8 text-xs flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-12 shrink-0">Hasta</label>
                <Input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => { setTo(e.target.value); setActivePreset("all") }}
                  className="h-8 text-xs flex-1"
                />
              </div>
            </div>
          </div>

          {/* Count indicator */}
          <p className="text-xs text-muted-foreground text-center">
            {filtered.length} gasto{filtered.length !== 1 ? "s" : ""} en el rango seleccionado
          </p>

          {/* Export buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleCSV}
              disabled={filtered.length === 0}
            >
              <Sheet className="h-4 w-4" />
              CSV
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handlePDF}
              disabled={filtered.length === 0}
            >
              <FileText className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
