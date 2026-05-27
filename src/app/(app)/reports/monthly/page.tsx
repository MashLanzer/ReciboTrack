"use client"

import { useState } from "react"
import { useMonthlyReport } from "@/hooks/use-monthly-report"
import { formatCurrency, cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Printer, FileText, TrendingUp, TrendingDown, Minus } from "lucide-react"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthName(month: number, year: number): string {
  return format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: es })
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/** Genera los últimos 12 meses como opciones */
function getLast12Months(): { year: number; month: number; label: string }[] {
  const result = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({
      year:  d.getFullYear(),
      month: d.getMonth() + 1,
      label: capitalizeFirst(format(d, "MMMM yyyy", { locale: es })),
    })
  }
  return result
}

// ─── Print button (inline since it's small) ──────────────────────────────────

function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className={cn(
        "print:hidden inline-flex items-center gap-2 px-4 py-2 rounded-lg",
        "bg-primary text-primary-foreground text-sm font-medium",
        "hover:bg-primary/90 active:scale-[0.97] transition-all"
      )}
    >
      <Printer className="h-4 w-4" />
      Imprimir / Guardar como PDF
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MonthlyReportPage() {
  const months = getLast12Months()
  const [selected, setSelected] = useState(() => `${months[0].year}-${months[0].month}`)

  const [year, month] = selected.split("-").map(Number)
  const { data, isLoading, isError } = useMonthlyReport(year, month)

  const title = capitalizeFirst(monthName(month, year))

  return (
    <>
      {/* Print-specific styles */}
      <style>{`
        @media print {
          .print-hide { display: none !important; }
          @page { margin: 1.5cm; }
          body { font-size: 12pt; }
        }
      `}</style>

      <div className="container max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 print-hide">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="font-serif text-2xl">Reportes</h1>
          </div>
          <PrintButton />
        </div>

        {/* ── Selector de mes (oculto al imprimir) ── */}
        <div className="print-hide">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── Loading ── */}
        {isLoading && (
          <div className="space-y-4 print-hide">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        )}

        {/* ── Error ── */}
        {isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center print-hide">
            <p className="text-sm font-medium text-destructive">Error al cargar el reporte</p>
          </div>
        )}

        {/* ── Report content ── */}
        {data && (
          <div className="space-y-6">

            {/* ══ HEADER DEL REPORTE ══ */}
            <div className="rounded-2xl border bg-card p-6 space-y-1 print:border-0 print:p-0 print:rounded-none">
              <h2 className="font-serif text-3xl font-bold">Reporte Mensual</h2>
              <p className="text-xl text-muted-foreground">{capitalizeFirst(title)}</p>
              <p className="text-xs text-muted-foreground mt-2 print:block hidden">
                Generado el {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
            </div>

            {/* ══ RESUMEN ══ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:grid-cols-3">
              <SummaryCard
                label="Total gastado"
                value={formatCurrency(data.totalSpent, data.currency)}
                icon={<TrendingDown className="h-4 w-4 text-destructive" />}
              />
              {data.totalIncome > 0 && (
                <SummaryCard
                  label="Total ingresos"
                  value={formatCurrency(data.totalIncome, data.currency)}
                  icon={<TrendingUp className="h-4 w-4 text-green-600" />}
                />
              )}
              {data.totalIncome > 0 && (
                <SummaryCard
                  label="Balance neto"
                  value={formatCurrency(data.netBalance, data.currency)}
                  icon={data.netBalance >= 0
                    ? <TrendingUp className="h-4 w-4 text-green-600" />
                    : <TrendingDown className="h-4 w-4 text-destructive" />}
                  highlight={data.netBalance >= 0 ? "positive" : "negative"}
                />
              )}
              {data.totalIncome === 0 && (
                <SummaryCard
                  label="Transacciones"
                  value={String(data.categories.reduce((s, c) => s + c.expenses.length, 0))}
                  icon={<Minus className="h-4 w-4 text-muted-foreground" />}
                />
              )}
            </div>

            {/* ══ DESGLOSE POR CATEGORÍA ══ */}
            {data.categories.length > 0 ? (
              <div className="rounded-2xl border bg-card overflow-hidden print:border print:rounded-none">
                <div className="px-5 py-3 border-b bg-muted/30">
                  <h3 className="font-semibold text-sm">Desglose por categoría</h3>
                </div>

                {/* Tabla de categorías */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/10">
                        <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoría</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Txs</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">%</th>
                        {data.categories.some((c) => c.budget !== null) && (
                          <th className="text-right px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Presupuesto</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {data.categories.map((cat, i) => {
                        const overBudget = cat.budget !== null && cat.amount > cat.budget
                        return (
                          <tr
                            key={cat.name}
                            className={cn(
                              "border-b last:border-b-0 print:break-inside-avoid",
                              i % 2 === 0 ? "bg-muted/10" : "bg-background"
                            )}
                          >
                            <td className="px-5 py-3 font-medium">{cat.name}</td>
                            <td className="text-right px-3 py-3 tabular-nums text-muted-foreground text-xs">
                              {cat.expenses.length}
                            </td>
                            <td className="text-right px-3 py-3 tabular-nums font-semibold">
                              {formatCurrency(cat.amount, data.currency)}
                            </td>
                            <td className="text-right px-3 py-3 tabular-nums text-muted-foreground text-xs">
                              {cat.percentage}%
                            </td>
                            {data.categories.some((c) => c.budget !== null) && (
                              <td className={cn("text-right px-5 py-3 tabular-nums text-xs", overBudget ? "text-destructive font-semibold" : "text-muted-foreground")}>
                                {cat.budget !== null
                                  ? overBudget
                                    ? `↑ ${formatCurrency(cat.amount - cat.budget, data.currency)}`
                                    : formatCurrency(cat.budget, data.currency)
                                  : "—"}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30">
                        <td className="px-5 py-3 font-bold">Total</td>
                        <td className="text-right px-3 py-3 tabular-nums text-xs text-muted-foreground">
                          {data.categories.reduce((s, c) => s + c.expenses.length, 0)}
                        </td>
                        <td className="text-right px-3 py-3 tabular-nums font-bold">
                          {formatCurrency(data.totalSpent, data.currency)}
                        </td>
                        <td className="text-right px-3 py-3 tabular-nums text-xs text-muted-foreground">100%</td>
                        {data.categories.some((c) => c.budget !== null) && <td />}
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Barra de porcentaje por categoría */}
                {data.categories.length > 1 && (
                  <div className="px-5 py-4 border-t">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Distribución</p>
                    <div className="flex rounded-full overflow-hidden h-3">
                      {data.categories.map((cat, i) => (
                        <div
                          key={cat.name}
                          title={`${cat.name}: ${cat.percentage}%`}
                          style={{
                            width: `${cat.percentage}%`,
                            backgroundColor: `hsl(${(i * 47) % 360}, 60%, 55%)`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {data.categories.slice(0, 8).map((cat, i) => (
                        <div key={cat.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: `hsl(${(i * 47) % 360}, 60%, 55%)` }}
                          />
                          {cat.name} ({cat.percentage}%)
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Sin gastos registrados en {title}</p>
              </div>
            )}

            {/* ══ DETALLE DE GASTOS POR CATEGORÍA ══ */}
            {data.categories.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Detalle de gastos</h3>
                {data.categories.map((cat) => (
                  <div key={cat.name} className="rounded-2xl border bg-card overflow-hidden print:break-inside-avoid">
                    <div className="px-5 py-3 border-b bg-muted/20 flex items-center justify-between">
                      <span className="font-semibold text-sm">{cat.name}</span>
                      <span className="text-sm tabular-nums font-semibold">{formatCurrency(cat.amount, data.currency)}</span>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {cat.expenses.map((exp, i) => (
                          <tr key={exp.id} className={cn("border-b last:border-b-0", i % 2 === 0 ? "bg-muted/5" : "")}>
                            <td className="px-5 py-2.5">
                              <p className="font-medium text-xs">{exp.merchant}</p>
                              {exp.notes && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{exp.notes}</p>}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(exp.date), "dd MMM", { locale: es })}
                            </td>
                            <td className="text-right px-5 py-2.5 tabular-nums text-xs font-semibold whitespace-nowrap">
                              {formatCurrency(exp.total, data.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}

            {/* ══ FOOTER ══ */}
            <div className="text-center text-xs text-muted-foreground py-4 border-t">
              Generado por ReciboTrack — {format(new Date(), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
            </div>
          </div>
        )}

      </div>
    </>
  )
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon,
  highlight,
}: {
  label:     string
  value:     string
  icon:      React.ReactNode
  highlight?: "positive" | "negative"
}) {
  return (
    <div className={cn(
      "rounded-2xl border p-4 space-y-1 print:rounded-lg",
      highlight === "positive" && "border-green-500/30 bg-green-500/5",
      highlight === "negative" && "border-destructive/30 bg-destructive/5",
    )}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span className="uppercase tracking-wide font-semibold">{label}</span>
      </div>
      <p className={cn(
        "text-2xl font-bold tabular-nums",
        highlight === "positive" && "text-green-700 dark:text-green-400",
        highlight === "negative" && "text-destructive",
      )}>{value}</p>
    </div>
  )
}
