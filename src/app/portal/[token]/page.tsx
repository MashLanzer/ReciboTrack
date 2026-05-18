/**
 * Public Portal View — no authentication required.
 * Fetches data from /api/portal/[token] which applies server-side permission masks.
 */
"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { formatCurrency, cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  Receipt, Shield, Clock, TrendingUp, AlertTriangle, Loader2,
  ChevronDown, ChevronRight,
} from "lucide-react"
import type { PortalData, MaskedExpense } from "@/lib/portal-permissions"

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchPortalData(token: string): Promise<PortalData> {
  const res = await fetch(`/api/portal/${token}`, { cache: "no-store" })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Error ${res.status}`)
  }
  return res.json()
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PortalPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData]       = useState<PortalData | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    fetchPortalData(token)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return <ErrorState message={error ?? "Portal no disponible"} />
  }

  return <PortalView data={data} />
}

// ── Error state ───────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">Portal no disponible</h1>
        <p className="text-sm text-muted-foreground mt-1">{message}</p>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

function PortalView({ data }: { data: PortalData }) {
  const { expenses, summary, permissions, portalName, ownerName, generatedAt } = data
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const showAmounts = permissions.showAmounts
  const fmt = (n: number | "***") =>
    n === "***" ? "***" : formatCurrency(n)

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header banner ── */}
      <div className="border-b bg-muted/30">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-foreground flex items-center justify-center shrink-0">
            <Receipt className="h-4 w-4 text-background" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{portalName}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Compartido por {ownerName} · Solo lectura
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(generatedAt), "d MMM HH:mm", { locale: es })}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            label="Total"
            value={showAmounts ? formatCurrency(summary.totalAmount) : "***"}
            sub={`${summary.expenseCount} gastos`}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          {summary.dateRange && (
            <SummaryCard
              label="Período"
              value={format(new Date(summary.dateRange.from), "d MMM", { locale: es })}
              sub={`→ ${format(new Date(summary.dateRange.to), "d MMM yyyy", { locale: es })}`}
              icon={<Clock className="h-4 w-4" />}
            />
          )}
        </div>

        {/* ── Category breakdown ── */}
        {permissions.showCategories && summary.byCategory.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Por categoría
            </h2>
            <div className="rounded-xl border divide-y overflow-hidden">
              {summary.byCategory.slice(0, 10).map(({ category, total, count }) => (
                <div key={category} className="flex items-center gap-3 px-4 py-2.5">
                  <p className="flex-1 text-sm capitalize">{category}</p>
                  <p className="text-xs text-muted-foreground">{count} gastos</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {showAmounts ? formatCurrency(total) : "***"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Expense list (if not totals-only) ── */}
        {!permissions.showTotalsOnly && expenses.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Gastos ({expenses.length})
            </h2>
            <div className="rounded-xl border divide-y overflow-hidden">
              {expenses.map((exp) => (
                <ExpenseRow
                  key={exp.id}
                  exp={exp}
                  expanded={expandedId === exp.id}
                  onToggle={() => setExpandedId(expandedId === exp.id ? null : exp.id)}
                  showAmounts={showAmounts}
                  showItems={permissions.showItems}
                  fmt={fmt}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Footer ── */}
        <p className="text-center text-[10px] text-muted-foreground pb-6">
          Generado por ReciboTrack · Los datos están filtrados por el propietario del portal
        </p>
      </div>
    </div>
  )
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, icon }: {
  label: string; value: string; sub: string; icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  )
}

// ── Expense row ───────────────────────────────────────────────────────────────

function ExpenseRow({ exp, expanded, onToggle, showAmounts, showItems, fmt }: {
  exp: MaskedExpense
  expanded: boolean
  onToggle: () => void
  showAmounts: boolean
  showItems: boolean
  fmt: (n: number | "***") => string
}) {
  const date = format(new Date(exp.date), "d MMM yyyy", { locale: es })
  const hasItems = showItems && exp.items && exp.items.length > 0

  return (
    <div>
      <button
        type="button"
        onClick={hasItems ? onToggle : undefined}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left",
          hasItems ? "hover:bg-muted/40 cursor-pointer" : "cursor-default",
        )}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {exp.merchant}
          </p>
          <p className="text-xs text-muted-foreground">
            {date}
            {exp.category && ` · ${exp.category}`}
            {exp.paymentMethod && ` · ${exp.paymentMethod}`}
          </p>
          {exp.notes && (
            <p className="text-xs text-muted-foreground italic mt-0.5 truncate">{exp.notes}</p>
          )}
          {exp.tags && exp.tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {exp.tags.map((t) => (
                <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md">{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          <span className="text-sm font-semibold tabular-nums">
            {fmt(exp.total)} {exp.currency}
          </span>
          {hasItems && (
            expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                     : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Line items */}
      {expanded && exp.items && (
        <div className="bg-muted/30 border-t px-4 py-2 space-y-1">
          {exp.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {item.quantity > 1 && `${item.quantity}× `}{item.name}
              </span>
              <span className="tabular-nums font-medium">
                {fmt(item.price)}
              </span>
            </div>
          ))}
          {showAmounts && (
            <div className="flex justify-between text-xs pt-1 border-t mt-1">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{fmt(exp.subtotal)}</span>
            </div>
          )}
          {showAmounts && exp.tax !== "***" && exp.tax > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Impuesto</span>
              <span className="tabular-nums">{fmt(exp.tax)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
