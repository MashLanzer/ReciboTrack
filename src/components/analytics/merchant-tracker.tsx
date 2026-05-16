"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { collection, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "@/hooks/use-auth"
import { useUIStore } from "@/stores/ui-store"
import { formatCurrency } from "@/lib/utils"
import { subMonths, startOfMonth } from "date-fns"
import type { Expense } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface MerchantStats {
  merchant: string
  visits: number
  amounts: number[] // ordered by date asc
  avg: number
  last: number
  delta: number // percentage
}

function use3MonthExpenses() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["expenses-3m-merchant", user?.uid],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user) return []
      const start = startOfMonth(subMonths(new Date(), 2))
      const col = collection(getFirebaseDb(), "users", user.uid, "expenses")
      const q = query(col, where("date", ">=", Timestamp.fromDate(start)), orderBy("date", "asc"))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)
    },
  })
}

function DeltaBadge({ delta }: { delta: number }) {
  const abs = Math.abs(delta)
  if (abs <= 5) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> Sin cambio
      </span>
    )
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
        <TrendingDown className="h-3 w-3" /> -{abs.toFixed(1)}%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
      <TrendingUp className="h-3 w-3" /> +{abs.toFixed(1)}%
    </span>
  )
}

export function MerchantTracker() {
  const { data: raw = [], isLoading } = use3MonthExpenses()
  const { activeAccount } = useUIStore()

  const merchantStats = useMemo<MerchantStats[]>(() => {
    // Filter by account
    const expenses = raw.filter((e) => {
      if (activeAccount === "business") return e.account === "business"
      return !e.account || e.account === "personal"
    })

    // Group by merchant (case-insensitive, trim)
    const map: Record<string, { amounts: number[]; dates: number[] }> = {}
    for (const e of expenses) {
      const key = e.merchant.trim().toLowerCase()
      if (!map[key]) map[key] = { amounts: [], dates: [] }
      map[key].amounts.push(e.total)
      map[key].dates.push(e.date.toMillis())
    }

    // Build stats — only merchants with ≥3 visits
    const stats: MerchantStats[] = []
    for (const [key, { amounts, dates }] of Object.entries(map)) {
      if (amounts.length < 3) continue

      // Sort by date asc (already from Firestore, but re-sort to be safe)
      const paired = amounts.map((a, i) => ({ a, d: dates[i] })).sort((x, y) => x.d - y.d)
      const sorted = paired.map((p) => p.a)

      const last = sorted[sorted.length - 1]
      const previous = sorted.slice(0, sorted.length - 1)
      const avg = previous.reduce((s, v) => s + v, 0) / previous.length
      const delta = avg > 0 ? ((last - avg) / avg) * 100 : 0

      // Recover display name: find most common casing
      const original = raw.find((e) => e.merchant.trim().toLowerCase() === key)?.merchant ?? key

      stats.push({
        merchant: original,
        visits: amounts.length,
        amounts: sorted,
        avg,
        last,
        delta,
      })
    }

    // Top 8 by visit count
    return stats.sort((a, b) => b.visits - a.visits).slice(0, 8)
  }, [raw, activeAccount])

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Evolución de precios por comercio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Evolución de precios por comercio</CardTitle>
        <p className="text-xs text-muted-foreground">Comercios con 3+ visitas · últimos 3 meses</p>
      </CardHeader>
      <CardContent>
        {merchantStats.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Necesitas más visitas registradas para ver el rastreo de precios
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-2">Comercio</th>
                  <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-2">Visitas</th>
                  <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-2">Promedio</th>
                  <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-2">Último</th>
                  <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-2">Cambio</th>
                </tr>
              </thead>
              <tbody>
                {merchantStats.map((m, i) => (
                  <tr key={m.merchant} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                    <td className="px-2 py-2.5">
                      <span className="text-xs font-medium truncate max-w-[120px] block">{m.merchant}</span>
                    </td>
                    <td className="text-right px-2 py-2.5 tabular-nums text-xs text-muted-foreground">
                      {m.visits}
                    </td>
                    <td className="text-right px-2 py-2.5 tabular-nums text-xs text-muted-foreground">
                      {formatCurrency(m.avg)}
                    </td>
                    <td className="text-right px-2 py-2.5 tabular-nums text-xs font-semibold">
                      {formatCurrency(m.last)}
                    </td>
                    <td className="text-right px-2 py-2.5">
                      <DeltaBadge delta={m.delta} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
