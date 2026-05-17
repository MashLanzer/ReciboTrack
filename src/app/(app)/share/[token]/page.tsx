"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import { decodeShareToken } from "@/lib/share-token"
import { useQuery } from "@tanstack/react-query"
import { collection, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
import { formatCurrency } from "@/lib/utils"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { es } from "date-fns/locale"
import type { Expense } from "@/types"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertTriangle, BarChart3, Receipt } from "lucide-react"

// ─── Data fetching ─────────────────────────────────────────────────────────────

function useSharedExpenses(uid: string | null, period: string | null) {
  return useQuery({
    queryKey: ["shared-expenses", uid, period],
    enabled: !!uid && !!period,
    queryFn: async () => {
      if (!uid || !period) return []
      const [year, month] = period.split("-").map(Number)
      if (!year || !month) return []
      const start = startOfMonth(new Date(year, month - 1))
      const end = endOfMonth(new Date(year, month - 1))
      const col = collection(getFirebaseDb(), "users", uid, "expenses")
      const q = query(
        col,
        where("date", ">=", Timestamp.fromDate(start)),
        where("date", "<=", Timestamp.fromDate(end)),
        orderBy("date", "desc")
      )
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense)
    },
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SharePortalPage() {
  const params = useParams()
  const token = Array.isArray(params.token) ? params.token[0] : (params.token ?? "")

  const payload = useMemo(() => decodeShareToken(token), [token])
  const { data: expenses = [], isLoading } = useSharedExpenses(
    payload?.uid ?? null,
    payload?.period ?? null
  )

  if (!payload) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-sm">
          <AlertTriangle className="h-10 w-10 mx-auto text-destructive" />
          <h1 className="font-semibold text-lg">Enlace inválido</h1>
          <p className="text-sm text-muted-foreground">
            Este enlace de resumen no es válido o ha expirado.
          </p>
        </div>
      </div>
    )
  }

  const [year, month] = payload.period.split("-").map(Number)
  const periodDate = new Date(year, (month || 1) - 1)
  const periodLabel = format(periodDate, "MMMM yyyy", { locale: es })
  const periodLabelCap = periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)

  const total = expenses.reduce((s, e) => s + e.total, 0)
  const txCount = expenses.length

  // Category breakdown
  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    expenses.forEach((e) => {
      map.set(e.category, (map.get(e.category) ?? 0) + e.total)
    })
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => ({ cat, amount, pct: total > 0 ? (amount / total) * 100 : 0 }))
  }, [expenses, total])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-6 py-8">
        <p className="text-xs font-mono uppercase tracking-widest opacity-70 mb-1">
          Resumen compartido · ReciboTrack
        </p>
        <h1 className="text-2xl font-bold">{payload.name}</h1>
        <p className="text-sm opacity-80 mt-0.5">{periodLabelCap}</p>
      </div>

      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-5">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border bg-card p-4 space-y-1">
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                  Total gastado
                </p>
                <p className="text-2xl font-bold tabular-nums">{formatCurrency(total)}</p>
              </div>
              <div className="rounded-2xl border bg-card p-4 space-y-1">
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                  Transacciones
                </p>
                <p className="text-2xl font-bold tabular-nums">{txCount}</p>
              </div>
            </div>

            {/* Category breakdown */}
            {byCategory.length > 0 && (
              <div className="rounded-2xl border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Por categoría</p>
                </div>
                <div className="space-y-2">
                  {byCategory.map(({ cat, amount, pct }) => (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm capitalize">{cat}</p>
                        <p className="text-sm font-semibold tabular-nums">{formatCurrency(amount)}</p>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expense list */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">
                  Gastos ({txCount})
                </p>
              </div>
              {expenses.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <p className="text-sm">Sin gastos en este período</p>
                </div>
              ) : (
                expenses.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 rounded-xl border bg-card p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.merchant}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(e.date.toDate(), "d MMM yyyy", { locale: es })}
                        {" · "}
                        <span className="capitalize">{e.category}</span>
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums shrink-0">
                      {formatCurrency(e.total, e.currency)}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-muted-foreground pt-2">
              Compartido con ReciboTrack · {payload.generatedAt ? format(new Date(payload.generatedAt), "d MMM yyyy HH:mm", { locale: es }) : ""}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
