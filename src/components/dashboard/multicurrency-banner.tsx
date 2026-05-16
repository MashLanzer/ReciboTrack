"use client"

import { useMemo } from "react"
import { useExchangeRates, convertAmount } from "@/hooks/use-exchange-rates"
import { useUserSettings } from "@/hooks/use-user-settings"
import { formatCurrency } from "@/lib/utils"
import { Loader2, RefreshCw } from "lucide-react"
import type { Expense } from "@/types"

interface Props {
  expenses: Expense[]
}

export function MultiCurrencyBanner({ expenses }: Props) {
  const { data: rates, isLoading, error } = useExchangeRates()
  const { data: settings } = useUserSettings()

  const baseCurrency = settings?.defaultCurrency ?? "USD"

  const { totalConverted, currencies, hasMultiple } = useMemo(() => {
    const currencySet = new Set(expenses.map((e) => e.currency))
    const hasMultiple = currencySet.size > 1

    if (!hasMultiple || !rates) {
      return { totalConverted: 0, currencies: [], hasMultiple }
    }

    const totalConverted = expenses.reduce((sum, e) => {
      return sum + convertAmount(e.total, e.currency, baseCurrency, rates.rates)
    }, 0)

    // Per-currency breakdown
    const currencyMap = new Map<string, number>()
    for (const e of expenses) {
      currencyMap.set(e.currency, (currencyMap.get(e.currency) ?? 0) + e.total)
    }

    const currencies = [...currencyMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cur, total]) => ({
        currency: cur,
        total,
        converted: convertAmount(total, cur, baseCurrency, rates.rates),
      }))

    return { totalConverted, currencies, hasMultiple }
  }, [expenses, rates, baseCurrency])

  if (!hasMultiple) return null

  return (
    <div className="rounded-2xl border bg-card px-4 py-3.5 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Total multi-moneda
        </p>
        {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        {error && (
          <span className="text-[10px] text-destructive flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Sin conexión a tipos de cambio
          </span>
        )}
      </div>

      {/* Converted total */}
      {rates && (
        <div className="space-y-1">
          <p className="text-xl font-bold tabular-nums">
            ≈ {formatCurrency(totalConverted, baseCurrency)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Convertido a {baseCurrency} · Tipo del{" "}
            {new Date(rates.updatedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
          </p>
        </div>
      )}

      {/* Per-currency rows */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {currencies.map(({ currency, total, converted }) => (
          <div key={currency} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">
              {formatCurrency(total, currency)}
            </span>
            {currency !== baseCurrency && rates && (
              <span>≈ {formatCurrency(converted, baseCurrency)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
