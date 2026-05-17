"use client"

import { useMemo } from "react"
import { formatCurrency } from "@/lib/utils"
import type { Expense } from "@/types"

const CURRENCY_REGIONS: Record<string, { flag: string; name: string }> = {
  USD: { flag: "🇺🇸", name: "Estados Unidos" },
  EUR: { flag: "🇪🇺", name: "Europa" },
  MXN: { flag: "🇲🇽", name: "México" },
  GBP: { flag: "🇬🇧", name: "Reino Unido" },
  COP: { flag: "🇨🇴", name: "Colombia" },
  ARS: { flag: "🇦🇷", name: "Argentina" },
  CLP: { flag: "🇨🇱", name: "Chile" },
  PEN: { flag: "🇵🇪", name: "Perú" },
  BRL: { flag: "🇧🇷", name: "Brasil" },
  CAD: { flag: "🇨🇦", name: "Canadá" },
  JPY: { flag: "🇯🇵", name: "Japón" },
  CNY: { flag: "🇨🇳", name: "China" },
  AUD: { flag: "🇦🇺", name: "Australia" },
  CHF: { flag: "🇨🇭", name: "Suiza" },
  SEK: { flag: "🇸🇪", name: "Suecia" },
  NOK: { flag: "🇳🇴", name: "Noruega" },
  DKK: { flag: "🇩🇰", name: "Dinamarca" },
  INR: { flag: "🇮🇳", name: "India" },
  KRW: { flag: "🇰🇷", name: "Corea del Sur" },
  SGD: { flag: "🇸🇬", name: "Singapur" },
  HKD: { flag: "🇭🇰", name: "Hong Kong" },
  NZD: { flag: "🇳🇿", name: "Nueva Zelanda" },
  ZAR: { flag: "🇿🇦", name: "Sudáfrica" },
  TRY: { flag: "🇹🇷", name: "Turquía" },
  RUB: { flag: "🇷🇺", name: "Rusia" },
  PLN: { flag: "🇵🇱", name: "Polonia" },
  CZK: { flag: "🇨🇿", name: "República Checa" },
  HUF: { flag: "🇭🇺", name: "Hungría" },
  RON: { flag: "🇷🇴", name: "Rumania" },
  BGN: { flag: "🇧🇬", name: "Bulgaria" },
  HRK: { flag: "🇭🇷", name: "Croacia" },
  ISK: { flag: "🇮🇸", name: "Islandia" },
  GTQ: { flag: "🇬🇹", name: "Guatemala" },
  HNL: { flag: "🇭🇳", name: "Honduras" },
  NIO: { flag: "🇳🇮", name: "Nicaragua" },
  CRC: { flag: "🇨🇷", name: "Costa Rica" },
  PAB: { flag: "🇵🇦", name: "Panamá" },
  DOP: { flag: "🇩🇴", name: "República Dominicana" },
  BOB: { flag: "🇧🇴", name: "Bolivia" },
  PYG: { flag: "🇵🇾", name: "Paraguay" },
  UYU: { flag: "🇺🇾", name: "Uruguay" },
  VEF: { flag: "🇻🇪", name: "Venezuela" },
  EGP: { flag: "🇪🇬", name: "Egipto" },
  MAD: { flag: "🇲🇦", name: "Marruecos" },
  AED: { flag: "🇦🇪", name: "Emiratos Árabes" },
  SAR: { flag: "🇸🇦", name: "Arabia Saudita" },
  ILS: { flag: "🇮🇱", name: "Israel" },
  THB: { flag: "🇹🇭", name: "Tailandia" },
  IDR: { flag: "🇮🇩", name: "Indonesia" },
  MYR: { flag: "🇲🇾", name: "Malasia" },
  PHP: { flag: "🇵🇭", name: "Filipinas" },
  VND: { flag: "🇻🇳", name: "Vietnam" },
}

interface RegionGroup {
  currency: string
  flag: string
  name: string
  total: number
  count: number
  topMerchant: string
}

interface Props {
  expenses: Expense[]
}

export function CitySpendingMap({ expenses }: Props) {
  const regions = useMemo<RegionGroup[]>(() => {
    const map = new Map<string, { total: number; count: number; merchants: Map<string, number> }>()

    for (const e of expenses) {
      const cur = e.currency || "USD"
      if (!map.has(cur)) {
        map.set(cur, { total: 0, count: 0, merchants: new Map() })
      }
      const r = map.get(cur)!
      r.total += e.total
      r.count++
      const m = r.merchants
      m.set(e.merchant, (m.get(e.merchant) ?? 0) + 1)
    }

    return Array.from(map.entries())
      .map(([currency, data]) => {
        const region = CURRENCY_REGIONS[currency] ?? { flag: "🌐", name: currency }
        const topMerchant = [...data.merchants.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"
        return {
          currency,
          flag: region.flag,
          name: region.name,
          total: data.total,
          count: data.count,
          topMerchant,
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [expenses])

  const currencies = useMemo(() => {
    const s = new Set(expenses.map(e => e.currency || "USD"))
    return [...s]
  }, [expenses])

  const maxTotal = regions[0]?.total ?? 1

  const allSameCurrency = currencies.length <= 1

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-4">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Mapa de regiones</p>
        <p className="text-sm font-bold mt-0.5">Gastos por region</p>
      </div>

      {allSameCurrency ? (
        <div className="text-center py-8 space-y-3">
          <span className="text-4xl">🌍</span>
          <div>
            <p className="text-sm font-semibold">Sin gastos en el extranjero</p>
            <p className="text-xs text-muted-foreground mt-1">
              Todos tus gastos son en <strong>{currencies[0] ?? "USD"}</strong>. Registra gastos en otras monedas para ver tu mapa de regiones.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {regions.map((r) => {
            const barPct = maxTotal > 0 ? (r.total / maxTotal) * 100 : 0
            return (
              <div key={r.currency} className="space-y-1.5">
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0 leading-none mt-0.5">{r.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{r.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {r.currency} · {r.count} transaccion{r.count !== 1 ? "es" : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold tabular-nums">{formatCurrency(r.total, r.currency)}</p>
                      </div>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-700"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">
                      Top: {r.topMerchant}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
