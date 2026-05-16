"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { collection, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "@/hooks/use-auth"
import { useCategories } from "@/hooks/use-categories"
import { formatCurrency } from "@/lib/utils"
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns"
import { es } from "date-fns/locale"
import type { Expense } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { GitBranch } from "lucide-react"

// ─── Data hook ─────────────────────────────────────────────────────────────────

function useSankeyData(monthOffset: number) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["expenses-sankey", user?.uid, monthOffset],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user) return []
      const ref = subMonths(new Date(), monthOffset)
      const start = startOfMonth(ref)
      const end = endOfMonth(ref)
      const col = collection(getFirebaseDb(), "users", user.uid, "expenses")
      const q = query(col,
        where("date", ">=", Timestamp.fromDate(start)),
        where("date", "<=", Timestamp.fromDate(end)),
        orderBy("date", "desc")
      )
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Expense)
    },
  })
}

// ─── Simple SVG Sankey ─────────────────────────────────────────────────────────

interface SankeyNode {
  id: string
  label: string
  value: number
  color: string
  x: number
  y: number
  height: number
}

interface SankeyLink {
  source: SankeyNode
  target: SankeyNode
  value: number
  sourceY: number
  targetY: number
}

const PAYMENT_COLORS: Record<string, string> = {
  "Tarjeta de crédito": "#6366f1",
  "Tarjeta de débito": "#8b5cf6",
  "Efectivo": "#10b981",
  "Transferencia": "#f59e0b",
  "PayPal": "#3b82f6",
  "Otro": "#6b7280",
}

function getPaymentColor(method: string): string {
  return PAYMENT_COLORS[method] ?? "#6b7280"
}

function SankeyDiagram({
  expenses,
  categories,
}: {
  expenses: Expense[]
  categories: { id: string; name: string; color: string; icon: string }[]
}) {
  const W = 420
  const H = 340
  const NODE_W = 12
  const PAD = 6
  const LEFT_X = 16
  const RIGHT_X = W - NODE_W - 16

  // Aggregate: payment method → category → amount
  const flows: Record<string, Record<string, number>> = {}
  expenses.forEach(e => {
    const pm = e.paymentMethod ?? "Otro"
    const cat = e.category
    if (!flows[pm]) flows[pm] = {}
    flows[pm][cat] = (flows[pm][cat] ?? 0) + e.total
  })

  // Source nodes (payment methods) — only ones with data
  const pmTotals: Record<string, number> = {}
  expenses.forEach(e => {
    const pm = e.paymentMethod ?? "Otro"
    pmTotals[pm] = (pmTotals[pm] ?? 0) + e.total
  })

  // Category totals
  const catTotals: Record<string, number> = {}
  expenses.forEach(e => {
    catTotals[e.category] = (catTotals[e.category] ?? 0) + e.total
  })

  const totalValue = Object.values(pmTotals).reduce((a, b) => a + b, 0)
  if (totalValue === 0) return (
    <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
      Sin datos para el período
    </div>
  )

  const usableH = H - PAD * 2
  const valueToH = (v: number) => Math.max((v / totalValue) * usableH, 4)

  // Build source nodes
  const pmSorted = Object.entries(pmTotals).sort((a, b) => b[1] - a[1])
  let yLeft = PAD
  const leftNodes: SankeyNode[] = pmSorted.map(([pm, val]) => {
    const h = valueToH(val)
    const node: SankeyNode = { id: pm, label: pm, value: val, color: getPaymentColor(pm), x: LEFT_X, y: yLeft, height: h }
    yLeft += h + PAD
    return node
  })

  // Build target nodes (categories)
  const catSorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 8)
  let yRight = PAD
  const rightNodes: SankeyNode[] = catSorted.map(([catId, val]) => {
    const h = valueToH(val)
    const cat = categories.find(c => c.id === catId)
    const node: SankeyNode = {
      id: catId, label: `${cat?.icon ?? "📦"} ${cat?.name ?? catId}`,
      value: val, color: cat?.color ?? "#6b7280",
      x: RIGHT_X, y: yRight, height: h,
    }
    yRight += h + PAD
    return node
  })

  // Build links
  const links: SankeyLink[] = []
  const leftOffsets: Record<string, number> = Object.fromEntries(leftNodes.map(n => [n.id, n.y]))
  const rightOffsets: Record<string, number> = Object.fromEntries(rightNodes.map(n => [n.id, n.y]))

  pmSorted.forEach(([pm]) => {
    const leftNode = leftNodes.find(n => n.id === pm)
    if (!leftNode) return
    const pmFlows = flows[pm] ?? {}
    Object.entries(pmFlows)
      .filter(([catId]) => rightNodes.some(n => n.id === catId))
      .sort((a, b) => b[1] - a[1])
      .forEach(([catId, val]) => {
        const rightNode = rightNodes.find(n => n.id === catId)
        if (!rightNode) return
        const lh = valueToH(val)
        const rh = valueToH(val)
        links.push({
          source: leftNode, target: rightNode,
          value: val,
          sourceY: leftOffsets[pm],
          targetY: rightOffsets[catId],
        })
        leftOffsets[pm] += lh
        rightOffsets[catId] += rh
      })
  })

  // Bezier path for each link
  function linkPath(link: SankeyLink): string {
    const x1 = link.source.x + NODE_W
    const y1 = link.sourceY + valueToH(link.value) / 2
    const x2 = link.target.x
    const y2 = link.targetY + valueToH(link.value) / 2
    const mx = (x1 + x2) / 2
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`
  }

  const [hovered, setHovered] = useState<SankeyLink | null>(null)

  return (
    <div className="relative">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        {/* Links */}
        {links.map((link, i) => {
          const lh = valueToH(link.value)
          const isHov = hovered === link
          return (
            <path
              key={i}
              d={linkPath(link)}
              fill="none"
              stroke={link.source.color}
              strokeWidth={Math.max(lh * 0.85, 1.5)}
              strokeOpacity={isHov ? 0.7 : 0.18}
              className="transition-all cursor-pointer"
              onMouseEnter={() => setHovered(link)}
              onMouseLeave={() => setHovered(null)}
            />
          )
        })}

        {/* Left nodes (payment methods) */}
        {leftNodes.map(node => (
          <g key={node.id}>
            <rect x={node.x} y={node.y} width={NODE_W} height={node.height}
              rx={3} fill={node.color} opacity={0.85} />
            <text
              x={node.x - 5} y={node.y + node.height / 2}
              textAnchor="end" dominantBaseline="middle"
              fontSize={9} fill="currentColor" opacity={0.8}
              className="select-none"
            >
              {node.label.length > 12 ? node.label.slice(0, 11) + "…" : node.label}
            </text>
          </g>
        ))}

        {/* Right nodes (categories) */}
        {rightNodes.map(node => (
          <g key={node.id}>
            <rect x={node.x} y={node.y} width={NODE_W} height={node.height}
              rx={3} fill={node.color} opacity={0.85} />
            <text
              x={node.x + NODE_W + 5} y={node.y + node.height / 2}
              textAnchor="start" dominantBaseline="middle"
              fontSize={9} fill="currentColor" opacity={0.8}
              className="select-none"
            >
              {node.label.length > 14 ? node.label.slice(0, 13) + "…" : node.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Hover tooltip */}
      {hovered && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-popover border rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none z-10">
          <p className="font-semibold">{hovered.source.label} → {hovered.target.label}</p>
          <p className="text-muted-foreground tabular-nums mt-0.5">{formatCurrency(hovered.value)}</p>
        </div>
      )}
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function SankeyChart() {
  const { data: categories = [] } = useCategories()
  const [monthOffset, setMonthOffset] = useState(0)
  const { data: expenses = [], isLoading } = useSankeyData(monthOffset)

  const now = new Date()
  const selectedMonth = subMonths(now, monthOffset)

  // Check if there's payment method data — if not, Sankey isn't useful
  const hasPaymentData = expenses.some(e => e.paymentMethod)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <GitBranch className="h-4 w-4 text-primary" />
            Flujo de gastos por método de pago
          </CardTitle>
          <Select value={String(monthOffset)} onValueChange={v => setMonthOffset(Number(v))}>
            <SelectTrigger className="h-7 text-xs w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4, 5].map(o => (
                <SelectItem key={o} value={String(o)} className="text-xs capitalize">
                  {format(subMonths(now, o), "MMMM", { locale: es })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Cómo fluye el dinero desde el método de pago hasta la categoría · {format(selectedMonth, "MMMM yyyy", { locale: es })}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : expenses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sin gastos en {format(selectedMonth, "MMMM", { locale: es })}</p>
          </div>
        ) : !hasPaymentData ? (
          <div className="text-center py-6 text-muted-foreground text-xs">
            <GitBranch className="h-6 w-6 mx-auto mb-2 opacity-30" />
            <p>Añade métodos de pago a tus gastos para ver el flujo</p>
          </div>
        ) : (
          <SankeyDiagram expenses={expenses} categories={categories} />
        )}

        {/* Legend */}
        {expenses.length > 0 && hasPaymentData && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
            {Object.entries(PAYMENT_COLORS)
              .filter(([pm]) => expenses.some(e => (e.paymentMethod ?? "Otro") === pm))
              .map(([pm, color]) => (
                <div key={pm} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
                  {pm}
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
