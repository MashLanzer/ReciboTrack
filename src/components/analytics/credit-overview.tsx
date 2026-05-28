"use client"

import Link from "next/link"
import { usePlaidLiabilities } from "@/hooks/use-plaid-liabilities"
import { useHasPlan } from "@/hooks/use-plan"
import { usePlaidItems } from "@/hooks/use-plaid"
import { formatCurrency, cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import {
  CreditCard as CreditCardIcon, AlertTriangle, ExternalLink,
  TrendingDown, ShieldCheck, Banknote, Sparkles, Zap,
} from "lucide-react"
import { format, differenceInDays } from "date-fns"
import { es } from "date-fns/locale"

// ─── Utilization color ────────────────────────────────────────────────────────

function utilizationColor(pct: number | null) {
  if (pct == null) return "text-muted-foreground"
  if (pct <= 30)  return "text-green-600 dark:text-green-400"
  if (pct <= 70)  return "text-warning"
  return "text-destructive"
}

function utilizationBarColor(pct: number | null) {
  if (pct == null) return ""
  if (pct <= 30)  return "[&>div]:bg-green-500"
  if (pct <= 70)  return "[&>div]:bg-yellow-500"
  return "[&>div]:bg-destructive"
}

function utilizationLabel(pct: number | null) {
  if (pct == null) return "Desconocida"
  if (pct <= 30)  return "Excelente"
  if (pct <= 70)  return "Moderada"
  return "Alta — reducir saldo"
}

// ─── Upgrade gate (non-premium) ───────────────────────────────────────────────

function UpgradeGate() {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border bg-card overflow-hidden">
        <div className="h-28 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent flex items-center justify-center">
          <CreditCardIcon className="h-12 w-12 text-primary" />
        </div>
        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-black tracking-tight">Analítica de crédito real</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Conecta tus bancos y ve en tiempo real la utilización de tus tarjetas, tasas de interés y fechas de pago.
            </p>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2 items-start"><Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Balances y límites de crédito en tiempo real</li>
            <li className="flex gap-2 items-start"><Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Porcentaje de utilización (impacto en credit score)</li>
            <li className="flex gap-2 items-start"><ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Alertas de pagos próximos a vencer</li>
          </ul>
          <Link href="/pricing" className="block">
            <Button className="w-full">Actualizar a Premium · $4.99/mes</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Empty state (premium, no banks) ─────────────────────────────────────────

function NoBanks() {
  return (
    <Card>
      <CardContent className="py-10 text-center space-y-3">
        <Banknote className="h-10 w-10 mx-auto text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold">No hay bancos conectados</p>
          <p className="text-xs text-muted-foreground mt-0.5">Conecta tu banco para ver datos de crédito en tiempo real</p>
        </div>
        <Link href="/banks">
          <Button size="sm" variant="outline">Conectar banco</Button>
        </Link>
      </CardContent>
    </Card>
  )
}

// ─── No credit accounts ───────────────────────────────────────────────────────

function NoCreditCards() {
  return (
    <Card>
      <CardContent className="py-10 text-center space-y-3">
        <CreditCardIcon className="h-10 w-10 mx-auto text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold">Sin tarjetas de crédito detectadas</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Solo se muestran cuentas de crédito. Las cuentas corrientes y de ahorro aparecen en{" "}
            <Link href="/banks" className="underline underline-offset-2">Bancos</Link>.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Si conectaste tu banco antes de esta actualización, reconéctalo para habilitar datos de crédito.
          </p>
        </div>
        <Link href="/banks">
          <Button size="sm" variant="outline">Reconectar banco</Button>
        </Link>
      </CardContent>
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CreditOverview() {
  const isPremium = useHasPlan("premium")
  const { data: items, isLoading: itemsLoading } = usePlaidItems()
  const { data, isLoading } = usePlaidLiabilities()

  if (!isPremium) return <UpgradeGate />

  if (itemsLoading || isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (!items || items.length === 0) return <NoBanks />

  const cards = data?.credit_cards ?? []
  if (cards.length === 0) return <NoCreditCards />

  const { total_balance, total_limit, total_utilization } = data!
  const today = new Date()
  const upcoming = cards.filter(c => {
    if (!c.next_payment_due) return false
    const due = new Date(c.next_payment_due)
    const days = differenceInDays(due, today)
    return days >= 0 && days <= 7
  })

  return (
    <div className="space-y-4">

      {/* ── Alertas de pago próximo ── */}
      {upcoming.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <p className="text-sm font-semibold text-warning">
              {upcoming.length === 1 ? "Pago próximo a vencer" : `${upcoming.length} pagos próximos a vencer`}
            </p>
          </div>
          {upcoming.map(c => {
            const due = new Date(c.next_payment_due!)
            const days = differenceInDays(due, today)
            return (
              <p key={c.account_id} className="text-xs text-muted-foreground ml-6">
                <span className="font-medium">{c.name ?? "Tarjeta"}</span>
                {c.mask && <span className="opacity-60"> ····{c.mask}</span>}
                {" — vence "}
                {days === 0 ? "hoy" : `en ${days} día${days !== 1 ? "s" : ""}`}
                {c.minimum_payment != null && ` · mínimo ${formatCurrency(c.minimum_payment, c.currency ?? undefined)}`}
              </p>
            )
          })}
        </div>
      )}

      {/* ── Utilización total ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <TrendingDown className="h-4 w-4 text-primary" />
            Utilización total de crédito
          </CardTitle>
          <p className="text-xs text-muted-foreground">Afecta directamente tu credit score — mantener bajo 30% es ideal</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className={cn("text-3xl font-black tabular-nums", utilizationColor(total_utilization))}>
                {total_utilization != null ? `${total_utilization}%` : "—"}
              </p>
              <p className={cn("text-xs font-medium mt-0.5", utilizationColor(total_utilization))}>
                {utilizationLabel(total_utilization)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold tabular-nums">{formatCurrency(total_balance)}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                de {total_limit != null ? formatCurrency(total_limit) : "límite desconocido"}
              </p>
            </div>
          </div>

          <Progress
            value={total_utilization ?? 0}
            className={cn("h-3", utilizationBarColor(total_utilization))}
          />

          {/* Leyenda */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-green-500" /> &lt;30% ideal</div>
            <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> 30–70% moderado</div>
            <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-destructive" /> &gt;70% alto</div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tarjetas individuales ── */}
      <div className="space-y-3">
        {cards.map(card => {
          const dueDate = card.next_payment_due ? new Date(card.next_payment_due) : null
          const daysUntilDue = dueDate ? differenceInDays(dueDate, today) : null

          return (
            <Card key={card.account_id} className={cn(card.overdue && "border-destructive/50")}>
              <CardContent className="pt-4 pb-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CreditCardIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="text-sm font-semibold truncate">
                        {card.name ?? "Tarjeta de crédito"}
                        {card.mask && <span className="text-xs text-muted-foreground font-normal ml-1.5">····{card.mask}</span>}
                      </p>
                    </div>
                    {card.institution_name && (
                      <p className="text-xs text-muted-foreground ml-6">{card.institution_name}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums">{formatCurrency(card.balance, card.currency ?? undefined)}</p>
                    {card.credit_limit != null && (
                      <p className="text-xs text-muted-foreground tabular-nums">de {formatCurrency(card.credit_limit!, card.currency ?? undefined)}</p>
                    )}
                  </div>
                </div>

                {/* Utilization bar */}
                {card.utilization != null && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className={cn("font-medium", utilizationColor(card.utilization))}>
                        {card.utilization}% utilizado
                      </span>
                      <span className={cn("font-semibold", utilizationColor(card.utilization))}>
                        {utilizationLabel(card.utilization)}
                      </span>
                    </div>
                    <Progress
                      value={card.utilization}
                      className={cn("h-2", utilizationBarColor(card.utilization))}
                    />
                  </div>
                )}

                {/* Info row */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">APR</p>
                    <p className="text-xs font-bold tabular-nums mt-0.5">
                      {card.interest_rate != null ? `${card.interest_rate}%` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Pago mín.</p>
                    <p className="text-xs font-bold tabular-nums mt-0.5">
                      {card.minimum_payment != null ? formatCurrency(card.minimum_payment!, card.currency ?? undefined) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Vence</p>
                    <p className={cn("text-xs font-bold tabular-nums mt-0.5", card.overdue && "text-destructive")}>
                      {dueDate
                        ? daysUntilDue === 0
                          ? "Hoy"
                          : daysUntilDue != null && daysUntilDue < 0
                            ? "Vencido"
                            : format(dueDate, "d MMM", { locale: es })
                        : "—"}
                    </p>
                  </div>
                </div>

                {/* Last payment */}
                {card.last_payment_date && (
                  <p className="text-xs text-muted-foreground">
                    Último pago:{" "}
                    {card.last_payment_amount != null && `${formatCurrency(card.last_payment_amount!, card.currency ?? undefined)} · `}
                    {format(new Date(card.last_payment_date), "d MMM yyyy", { locale: es })}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Enlace al reporte oficial ── */}
      <div className="rounded-xl border bg-card px-4 py-4 space-y-2">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Ver tu reporte de crédito oficial</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              AnnualCreditReport.com es el único sitio oficial del gobierno de EE.UU. para obtener tu reporte gratis de Equifax, Experian y TransUnion.
            </p>
          </div>
        </div>
        <a
          href="https://www.annualcreditreport.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          Ir a AnnualCreditReport.com
        </a>
        <p className="text-xs text-muted-foreground text-center">
          ReciboTrack no accede a datos de bureaus (Experian, Equifax, TransUnion) — los datos de arriba vienen directamente de tus bancos conectados.
        </p>
      </div>

    </div>
  )
}
