"use client"

import { useState, useMemo } from "react"
import { useExpenses } from "@/hooks/use-expenses"
import { useUIStore } from "@/stores/ui-store"
import { useCategories } from "@/hooks/use-categories"
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings"
import { formatCurrency } from "@/lib/utils"
import { startOfQuarter, endOfQuarter, subQuarters, format } from "date-fns"
import { es } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Receipt, Download, ChevronDown, ChevronUp, Info } from "lucide-react"
import type { Expense } from "@/types"

// ─── Quarter selector helper ──────────────────────────────────────────────────

function quarterLabel(offset: number): string {
  const date = subQuarters(new Date(), offset)
  const q = Math.floor(date.getMonth() / 3) + 1
  return `T${q} ${date.getFullYear()}`
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportVATcsv(
  expenses: Expense[],
  deductibleCats: string[],
  label: string,
) {
  const rows = expenses
    .filter(e => deductibleCats.includes(e.category))
    .map(e => [
      e.date.toDate().toLocaleDateString("es"),
      `"${e.merchant.replace(/"/g, '""')}"`,
      e.category,
      e.subtotal.toFixed(2),
      e.tax.toFixed(2),
      e.total.toFixed(2),
      e.currency,
      `"${(e.notes ?? "").replace(/"/g, '""')}"`,
    ].join(","))

  const header = "Fecha,Comercio,Categoría,Subtotal,IVA/Tax,Total,Moneda,Notas"
  const csv = [header, ...rows].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `gastos-deducibles-${label.replace(/\s/g, "-")}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function VATReport() {
  const { data: settings } = useUserSettings()
  const updateSettings = useUpdateUserSettings()
  const { data: categories = [] } = useCategories()
  const { activeAccount } = useUIStore()

  const [quarterOffset, setQuarterOffset] = useState(0)
  const [showConfig, setShowConfig] = useState(false)

  // Deductible categories stored in user settings
  const deductibleCats: string[] = settings?.deductibleCategories ?? []

  const quarterDate  = subQuarters(new Date(), quarterOffset)
  const quarterStart = startOfQuarter(quarterDate)
  const quarterEnd   = endOfQuarter(quarterDate)

  const { data: result } = useExpenses({ startDate: quarterStart, endDate: quarterEnd, account: activeAccount })
  const allExpenses = result?.expenses ?? []

  // Only deductible expenses
  const deductibleExpenses = useMemo(() =>
    allExpenses.filter(e => deductibleCats.includes(e.category)),
    [allExpenses, deductibleCats]
  )

  const totals = useMemo(() => {
    const subtotal = deductibleExpenses.reduce((a, e) => a + e.subtotal, 0)
    const tax      = deductibleExpenses.reduce((a, e) => a + e.tax, 0)
    const total    = deductibleExpenses.reduce((a, e) => a + e.total, 0)

    // By category
    const byCat: Record<string, { subtotal: number; tax: number; total: number; count: number }> = {}
    deductibleExpenses.forEach(e => {
      if (!byCat[e.category]) byCat[e.category] = { subtotal: 0, tax: 0, total: 0, count: 0 }
      byCat[e.category].subtotal += e.subtotal
      byCat[e.category].tax      += e.tax
      byCat[e.category].total    += e.total
      byCat[e.category].count++
    })

    return { subtotal, tax, total, byCat }
  }, [deductibleExpenses])

  async function toggleDeductible(catId: string, checked: boolean) {
    const current: string[] = (settings as any)?.deductibleCategories ?? []
    const next = checked ? [...current, catId] : current.filter((c: string) => c !== catId)
    try {
      await updateSettings.mutateAsync({ deductibleCategories: next })
    } catch {
      toast.error("Error al guardar")
    }
  }

  const label = quarterLabel(quarterOffset)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Receipt className="h-4 w-4 text-primary" />
            Informe IVA / Gastos deducibles
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={String(quarterOffset)} onValueChange={v => setQuarterOffset(Number(v))}>
              <SelectTrigger className="h-7 text-xs w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3].map(o => (
                  <SelectItem key={o} value={String(o)} className="text-xs">{quarterLabel(o)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Config toggle */}
        <button
          onClick={() => setShowConfig(s => !s)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Info className="h-3.5 w-3.5" />
          Categorías deducibles
          {showConfig ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {showConfig && (
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
            <p className="text-xs text-muted-foreground">
              Marca las categorías cuyos gastos son deducibles fiscalmente
            </p>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2">
                  <Switch
                    id={`deduct-${cat.id}`}
                    checked={deductibleCats.includes(cat.id)}
                    onCheckedChange={checked => toggleDeductible(cat.id, checked)}
                  />
                  <Label htmlFor={`deduct-${cat.id}`} className="text-xs cursor-pointer">
                    {cat.icon} {cat.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {deductibleCats.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sin categorías deducibles configuradas</p>
            <p className="text-xs mt-1">Abre "Categorías deducibles" para empezar</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowConfig(true)}>
              Configurar
            </Button>
          </div>
        ) : deductibleExpenses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sin gastos deducibles en {label}
          </p>
        ) : (
          <>
            {/* Summary strip */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/40 px-2 py-2.5">
                <p className="text-[10px] text-muted-foreground font-mono uppercase">Base</p>
                <p className="font-bold tabular-nums text-sm mt-0.5">{formatCurrency(totals.subtotal)}</p>
              </div>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-2.5">
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-mono uppercase">IVA/Tax</p>
                <p className="font-bold tabular-nums text-sm mt-0.5">{formatCurrency(totals.tax)}</p>
              </div>
              <div className="rounded-lg bg-muted/40 px-2 py-2.5">
                <p className="text-[10px] text-muted-foreground font-mono uppercase">Total</p>
                <p className="font-bold tabular-nums text-sm mt-0.5">{formatCurrency(totals.total)}</p>
              </div>
            </div>

            {/* By category */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Por categoría · {label}</p>
              {Object.entries(totals.byCat)
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([catId, data]) => {
                  const cat = categories.find(c => c.id === catId)
                  return (
                    <div key={catId} className="flex items-center justify-between text-xs rounded-lg px-3 py-2 bg-muted/30">
                      <div className="flex items-center gap-2">
                        <span>{cat?.icon ?? "📦"}</span>
                        <span className="font-medium">{cat?.name ?? catId}</span>
                        <Badge variant="secondary" className="text-[10px] h-4">{data.count}</Badge>
                      </div>
                      <div className="flex items-center gap-4 tabular-nums">
                        <span className="text-muted-foreground text-[10px]">
                          IVA: {formatCurrency(data.tax)}
                        </span>
                        <span className="font-semibold">{formatCurrency(data.total)}</span>
                      </div>
                    </div>
                  )
                })}
            </div>

            {/* Export button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs"
              onClick={() => {
                exportVATcsv(deductibleExpenses, deductibleCats, label)
                toast.success("CSV exportado")
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Exportar CSV deducibles · {label}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
