"use client"

import { useState, useMemo } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useCategories } from "@/hooks/use-categories"
import {
  useMyGroups, useGroupExpenses, useGroupSettlements,
  useCreateGroup, useJoinGroup, useLeaveGroup,
  useAddGroupExpense, useDeleteGroupExpense, useUpdateGroupExpense,
  useSettleDebt, useDeleteSettlement,
  useRefreshInviteCode, useUpdateGroup, useArchiveGroup, useUnarchiveGroup,
  type Group, type GroupExpense, type GroupSettlement,
} from "@/hooks/use-groups"
import { formatCurrency, toDate } from "@/lib/utils"
import { format, startOfMonth, endOfMonth, subMonths, isSameMonth } from "date-fns"
import { es } from "date-fns/locale"
import { PAYMENT_METHODS, CURRENCIES, DEFAULT_CATEGORIES } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { CommentButton } from "@/components/groups/group-comments"
import { AuditLogButton } from "@/components/groups/expense-audit-log"
import {
  Users, Plus, LogOut, Copy, RefreshCw, Trash2, Archive, ArchiveRestore,
  ArrowLeft, Receipt, UserPlus, Crown, Check, Pencil, MoreVertical,
  Search, SlidersHorizontal, TrendingUp, HandCoins, History,
  ChevronDown, ChevronUp, BarChart2, X, Share2,
} from "lucide-react"
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip,
  CartesianGrid,
} from "recharts"
import { cn } from "@/lib/utils"

// ─── Constants ─────────────────────────────────────────────────────────────────

const GROUP_EMOJIS = ["👨‍👩‍👧‍👦", "👫", "🏠", "💼", "🎓", "✈️", "🎉", "💰", "🍽️", "🛒", "🚗", "🏋️", "🏖️", "🎮", "🐾"]

// ─── Balance calculation (shared between tabs) ────────────────────────────────

function computeBalances(
  expenses: GroupExpense[],
  settlements: GroupSettlement[],
  members: Group["members"]
): Record<string, number> {
  const map: Record<string, number> = {}
  members.forEach((m) => { map[m.uid] = 0 })

  // Expenses
  expenses.forEach((e) => {
    if (e.splitType === "equal") {
      const uids = e.splitWith.length > 0 ? e.splitWith : [e.paidByUid]
      const share = e.total / uids.length
      uids.forEach((uid) => {
        if (uid !== e.paidByUid) {
          map[e.paidByUid] = (map[e.paidByUid] ?? 0) + share
          map[uid] = (map[uid] ?? 0) - share
        }
      })
    } else if (e.splitType === "custom" && e.customShares) {
      Object.entries(e.customShares).forEach(([uid, amount]) => {
        if (uid !== e.paidByUid && amount > 0) {
          map[e.paidByUid] = (map[e.paidByUid] ?? 0) + amount
          map[uid] = (map[uid] ?? 0) - amount
        }
      })
    }
    // "full" = no split
  })

  // Settlements: fromUid paid toUid → fromUid debt decreases, toUid credit decreases
  settlements.forEach((s) => {
    map[s.fromUid] = (map[s.fromUid] ?? 0) + s.amount
    map[s.toUid]   = (map[s.toUid]   ?? 0) - s.amount
  })

  return map
}

// ─── Expense form (reused for add & edit) ─────────────────────────────────────

interface ExpenseFormState {
  merchant: string; date: string; total: string
  subtotal: string; tax: string; category: string
  paymentMethod: string; currency: string; notes: string
  splitType: "equal" | "full" | "custom"
  splitWith: string[]
  customShares: Record<string, string>
}

function emptyExpenseForm(members: Group["members"]): ExpenseFormState {
  return {
    merchant: "", date: new Date().toISOString().split("T")[0],
    total: "", subtotal: "", tax: "0",
    category: "otros", paymentMethod: "", currency: "USD", notes: "",
    splitType: "equal",
    splitWith: members.map((m) => m.uid),
    customShares: Object.fromEntries(members.map((m) => [m.uid, ""])),
  }
}

function ExpenseForm({
  form, setForm, group, categories, currentUid, onSave, saving, title,
}: {
  form: ExpenseFormState
  setForm: (f: ExpenseFormState) => void
  group: Group
  categories: { id: string; name: string; icon: string }[]
  currentUid: string
  onSave: () => void
  saving: boolean
  title: string
}) {
  const allCats = categories.length > 0 ? categories : DEFAULT_CATEGORIES

  function distributeEqually() {
    const total = parseFloat(form.total) || 0
    const count = form.splitWith.length
    if (count === 0) return
    const share = (total / count).toFixed(2)
    setForm({ ...form, customShares: Object.fromEntries(form.splitWith.map((uid) => [uid, share])) })
  }

  const sharesSum = form.splitWith.reduce(
    (acc, uid) => acc + (parseFloat(form.customShares[uid] ?? "0") || 0), 0
  )
  const totalAmt = parseFloat(form.total) || 0
  const diff = totalAmt - sharesSum
  const customOk = Math.abs(diff) < 0.01

  return (
    <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
      <p className="font-medium text-sm">{title}</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Comercio *</Label>
          <Input
            placeholder="Netflix, Renta, Supermercado..."
            value={form.merchant}
            onChange={(e) => setForm({ ...form, merchant: e.target.value })}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label>Fecha</Label>
          <Input type="date" value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Total *</Label>
          <Input type="number" step="0.01" placeholder="0.00" value={form.total}
            className="tabular-nums"
            onChange={(e) => setForm({ ...form, total: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Categoría</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {allCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Moneda</Label>
          <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Notas</Label>
          <Input placeholder="Opcional..." value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>

      {/* Split */}
      <div className="rounded-xl border p-3 space-y-3">
        <p className="text-xs font-semibold">División del gasto</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(["equal", "custom", "full"] as const).map((type) => (
            <button key={type} onClick={() => setForm({ ...form, splitType: type })}
              className={`rounded-lg border p-2 text-[11px] text-center transition-colors leading-tight ${form.splitType === type ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground hover:border-muted-foreground"}`}>
              {type === "equal" ? "÷ Iguales" : type === "custom" ? "⚖️ Personal" : "👤 Solo yo"}
            </button>
          ))}
        </div>

        {form.splitType !== "full" && (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">¿Quiénes participan?</p>
            {group.members.map((m) => {
              const checked = form.splitWith.includes(m.uid)
              return (
                <div key={m.uid} className="flex items-center gap-2">
                  <input type="checkbox" checked={checked}
                    onChange={(e) => setForm({
                      ...form,
                      splitWith: e.target.checked
                        ? [...form.splitWith, m.uid]
                        : form.splitWith.filter((u) => u !== m.uid),
                    })} className="shrink-0" />
                  <span className="text-xs flex-1 truncate">
                    {m.displayName}{m.uid === currentUid ? " (tú)" : ""}
                  </span>
                  {form.splitType === "custom" && checked && (
                    <Input type="number" step="0.01" min={0}
                      value={form.customShares[m.uid] ?? ""}
                      onChange={(e) => setForm({
                        ...form,
                        customShares: { ...form.customShares, [m.uid]: e.target.value },
                      })}
                      className="w-24 h-7 text-xs tabular-nums text-right" placeholder="0.00" />
                  )}
                </div>
              )
            })}

            {form.splitType === "equal" && form.splitWith.length > 0 && form.total && (
              <p className="text-[11px] text-muted-foreground pt-1 border-t">
                Por persona: <span className="font-medium tabular-nums">
                  {formatCurrency(parseFloat(form.total) / form.splitWith.length, form.currency)}
                </span>
              </p>
            )}

            {form.splitType === "custom" && (
              <div className="pt-1 border-t flex items-center justify-between">
                <button onClick={distributeEqually}
                  className="text-[11px] text-primary hover:underline">
                  Distribuir igualmente
                </button>
                <span className={`text-[11px] tabular-nums font-medium ${customOk ? "text-green-600" : "text-destructive"}`}>
                  {customOk ? "✓ Correcto"
                    : diff > 0 ? `Faltan ${formatCurrency(diff, form.currency)}`
                    : `Excede ${formatCurrency(Math.abs(diff), form.currency)}`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <Button className="w-full" onClick={onSave} disabled={saving}>
        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
        {title}
      </Button>
    </div>
  )
}

// ─── Stats tab ─────────────────────────────────────────────────────────────────

function StatsTab({
  expenses, group, categories,
}: {
  expenses: GroupExpense[]
  group: Group
  categories: { id: string; name: string; icon: string; color?: string }[]
}) {
  const allCats = categories.length > 0 ? categories : DEFAULT_CATEGORIES

  const total = expenses.reduce((a, e) => a + e.total, 0)
  const count = expenses.length
  const avg = count > 0 ? total / count : 0
  const maxExpense = expenses.length > 0 ? Math.max(...expenses.map((e) => e.total)) : 0

  // Per-member spending (who paid)
  const memberSpend = useMemo(() => {
    const map: Record<string, number> = {}
    expenses.forEach((e) => {
      map[e.paidByUid] = (map[e.paidByUid] ?? 0) + e.total
    })
    return group.members
      .map((m) => ({ uid: m.uid, name: m.displayName, total: map[m.uid] ?? 0 }))
      .sort((a, b) => b.total - a.total)
  }, [expenses, group.members])

  // Category breakdown
  const catBreakdown = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {}
    expenses.forEach((e) => {
      if (!map[e.category]) map[e.category] = { total: 0, count: 0 }
      map[e.category].total += e.total
      map[e.category].count++
    })
    return Object.entries(map)
      .map(([id, { total: t, count: c }]) => {
        const cat = allCats.find((x) => x.id === id)
        return { id, name: cat?.name ?? id, icon: cat?.icon ?? "📦", color: cat?.color ?? "#6b7280", total: t, count: c, pct: total > 0 ? (t / total) * 100 : 0 }
      })
      .sort((a, b) => b.total - a.total)
  }, [expenses, total, allCats])

  // Monthly trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const month = subMonths(today, 5 - i)
      const s = startOfMonth(month)
      const e = endOfMonth(month)
      const monthTotal = expenses
        .filter((ex) => { const d = ex.date.toDate(); return d >= s && d <= e })
        .reduce((a, ex) => a + ex.total, 0)
      return {
        month: format(month, "MMM", { locale: es }),
        fullMonth: format(month, "MMMM yyyy", { locale: es }),
        total: monthTotal,
        isCurrent: isSameMonth(month, today),
      }
    })
  }, [expenses])

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <BarChart2 className="h-10 w-10 text-muted-foreground opacity-30" />
        <p className="text-sm text-muted-foreground">Sin datos aún. Añade gastos al grupo para ver estadísticas.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total gastado", value: formatCurrency(total) },
          { label: "Transacciones", value: String(count) },
          { label: "Promedio por gasto", value: formatCurrency(avg) },
          { label: "Mayor gasto", value: formatCurrency(maxExpense) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border bg-card px-4 py-3">
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{label}</p>
            <p className="text-lg font-bold tabular-nums mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Who pays most */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Gasto por miembro</CardTitle>
        </CardHeader>
        <CardContent className="-mx-2">
          <ResponsiveContainer width="100%" height={Math.max(memberSpend.length * 44, 100)}>
            <BarChart
              layout="vertical"
              data={memberSpend}
              margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
            >
              <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
              <Tooltip
                formatter={(v) => [formatCurrency(Number(v)), "Pagó"]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {memberSpend.map((_, i) => (
                  <Cell key={i} fill="hsl(var(--foreground))" fillOpacity={i === 0 ? 0.9 : 0.3 - i * 0.05} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Tendencia mensual</CardTitle>
        </CardHeader>
        <CardContent className="-mx-2">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={monthlyTrend} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} width={36} />
              <Tooltip
                formatter={(v) => [formatCurrency(Number(v)), "Total"]}
                labelFormatter={(_: unknown, payload: ReadonlyArray<{ payload?: { fullMonth?: string } }>) => payload?.[0]?.payload?.fullMonth ?? ""}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {monthlyTrend.map((entry, i) => (
                  <Cell key={i} fill="hsl(var(--foreground))" fillOpacity={entry.isCurrent ? 0.9 : 0.25} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category breakdown */}
      {catBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Por categoría</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-4 py-2">Categoría</th>
                  <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-2">Txns</th>
                  <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-2">%</th>
                  <th className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-4 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {catBreakdown.map((cat, i) => (
                  <tr key={cat.id} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-muted/20" : "")}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                        <span className="text-xs">{cat.icon}</span>
                        <span className="text-xs font-medium truncate max-w-[90px]">{cat.name}</span>
                      </div>
                    </td>
                    <td className="text-right px-2 py-2.5 tabular-nums text-xs text-muted-foreground">{cat.count}</td>
                    <td className="text-right px-2 py-2.5 tabular-nums text-xs text-muted-foreground">{cat.pct.toFixed(1)}%</td>
                    <td className="text-right px-4 py-2.5 tabular-nums text-xs font-semibold">{formatCurrency(cat.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Balance tab ───────────────────────────────────────────────────────────────

// ─── Debt simplification (minimum-transfers algorithm) ─────────────────────────

interface Transfer {
  from: string
  to: string
  amount: number
}

function simplifyDebts(balances: Record<string, number>): Transfer[] {
  // Separate creditors (positive) and debtors (negative)
  const creditors = Object.entries(balances)
    .filter(([, b]) => b > 0.01)
    .map(([uid, b]) => ({ uid, amount: b }))
    .sort((a, b) => b.amount - a.amount)

  const debtors = Object.entries(balances)
    .filter(([, b]) => b < -0.01)
    .map(([uid, b]) => ({ uid, amount: -b }))
    .sort((a, b) => b.amount - a.amount)

  const transfers: Transfer[] = []

  // Greedy matching: largest debt with largest credit
  let ci = 0, di = 0
  const creds = creditors.map(c => ({ ...c }))
  const debts = debtors.map(d => ({ ...d }))

  while (ci < creds.length && di < debts.length) {
    const amount = Math.min(creds[ci].amount, debts[di].amount)
    if (amount > 0.01) {
      transfers.push({ from: debts[di].uid, to: creds[ci].uid, amount: parseFloat(amount.toFixed(2)) })
    }
    creds[ci].amount -= amount
    debts[di].amount -= amount
    if (creds[ci].amount < 0.01) ci++
    if (debts[di].amount < 0.01) di++
  }

  return transfers
}

function BalanceTab({
  group, expenses, settlements, currentUid,
}: {
  group: Group
  expenses: GroupExpense[]
  settlements: GroupSettlement[]
  currentUid: string
}) {
  const settleDebt = useSettleDebt()
  const deleteSettlement = useDeleteSettlement()
  const [settleDialog, setSettleDialog] = useState<{ fromUid: string; toUid: string; amount: number } | null>(null)
  const [settleAmount, setSettleAmount] = useState("")
  const [settleNote, setSettleNote] = useState("")
  const [settleCurrency, setSettleCurrency] = useState("USD")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [liquidationOpen, setLiquidationOpen] = useState(false)

  const balances = computeBalances(expenses, settlements, group.members)
  const myBalance = balances[currentUid] ?? 0

  // Sorted: negative first (I owe), then positive (I'm owed)
  const othersWithBalance = group.members
    .filter((m) => m.uid !== currentUid)
    .map((m) => ({ ...m, balance: balances[m.uid] ?? 0 }))
    .filter((m) => Math.abs(m.balance) > 0.01)
    .sort((a, b) => a.balance - b.balance)

  async function handleSettle() {
    if (!settleDialog) return
    const amount = parseFloat(settleAmount)
    if (!amount || amount <= 0) { toast.error("Monto inválido"); return }
    try {
      await settleDebt.mutateAsync({
        groupId: group.id,
        fromUid: settleDialog.fromUid,
        toUid: settleDialog.toUid,
        amount,
        currency: settleCurrency,
        note: settleNote,
      })
      toast.success("Pago registrado")
      setSettleDialog(null)
      setSettleAmount("")
      setSettleNote("")
    } catch { toast.error("Error al registrar el pago") }
  }

  function getName(uid: string) {
    return group.members.find((m) => m.uid === uid)?.displayName ?? uid
  }

  return (
    <div className="space-y-4">
      {/* My balance hero */}
      <div className={`rounded-xl px-4 py-4 text-center ${
        myBalance > 0.01 ? "bg-green-500/10 border border-green-500/20"
        : myBalance < -0.01 ? "bg-destructive/10 border border-destructive/20"
        : "bg-muted/50 border"
      }`}>
        <p className="text-xs text-muted-foreground mb-1">Tu balance neto</p>
        <p className={`text-3xl font-bold tabular-nums ${
          myBalance > 0.01 ? "text-green-600"
          : myBalance < -0.01 ? "text-destructive"
          : "text-muted-foreground"
        }`}>
          {myBalance > 0.01 ? "+" : ""}{formatCurrency(myBalance)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {myBalance > 0.01 ? "te deben en total"
           : myBalance < -0.01 ? "debes en total"
           : "estás en cero 🎉"}
        </p>
      </div>

      {/* Per-person debts */}
      {othersWithBalance.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Detalles</p>
          {group.members.filter((m) => m.uid !== currentUid).map((m) => {
            const balance = balances[m.uid] ?? 0
            if (Math.abs(balance) < 0.01) return (
              <div key={m.uid} className="flex items-center gap-3 p-3 rounded-xl border bg-muted/20">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                  {m.displayName[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{m.displayName}</p>
                  <p className="text-[10px] text-muted-foreground">en cero ✓</p>
                </div>
              </div>
            )

            // balance > 0 → m owes me; balance < 0 → I owe m
            const iOweM = balance < 0
            const amount = Math.abs(balance)

            return (
              <div key={m.uid} className={`flex items-center gap-3 p-3 rounded-xl border ${iOweM ? "border-destructive/30 bg-destructive/5" : "border-green-500/30 bg-green-500/5"}`}>
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0">
                  {m.displayName[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{m.displayName}</p>
                  <p className={`text-[11px] font-medium tabular-nums ${iOweM ? "text-destructive" : "text-green-600"}`}>
                    {iOweM ? `Le debes ${formatCurrency(amount)}` : `Te debe ${formatCurrency(amount)}`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={iOweM ? "destructive" : "outline"}
                  className="h-7 px-2.5 text-xs gap-1 shrink-0"
                  onClick={() => {
                    // fromUid = debtor, toUid = creditor
                    const fromUid = iOweM ? currentUid : m.uid
                    const toUid   = iOweM ? m.uid       : currentUid
                    setSettleDialog({ fromUid, toUid, amount })
                    setSettleAmount(amount.toFixed(2))
                    setSettleCurrency("USD")
                    setSettleNote("")
                  }}
                >
                  <HandCoins className="h-3 w-3" />
                  Saldar
                </Button>
              </div>
            )
          })}
        </div>
      ) : expenses.length > 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-2xl mb-2">🎉</p>
          <p className="text-sm font-medium">¡Todos en cero!</p>
          <p className="text-xs mt-1">No hay deudas pendientes en el grupo.</p>
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-sm">Sin gastos registrados aún.</p>
        </div>
      )}

      {/* Liquidación mínima */}
      {expenses.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs"
          onClick={() => setLiquidationOpen(true)}
        >
          <HandCoins className="h-3.5 w-3.5" />
          Ver liquidación mínima del período
        </Button>
      )}

      {/* Settlements history */}
      {settlements.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Pagos registrados ({settlements.length})
            </span>
            {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {historyOpen && (
            <div className="border-t divide-y">
              {settlements.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 group">
                  <HandCoins className="h-4 w-4 text-green-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {getName(s.fromUid)} → {getName(s.toUid)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(s.date.toDate(), "d MMM yyyy", { locale: es })}
                      {s.note ? ` · ${s.note}` : ""}
                    </p>
                  </div>
                  <p className="text-xs font-semibold tabular-nums text-green-600 shrink-0">
                    {formatCurrency(s.amount, s.currency)}
                  </p>
                  {(s.fromUid === currentUid || s.toUid === currentUid) && (
                    <button
                      onClick={() => deleteSettlement.mutateAsync({ groupId: group.id, settlementId: s.id })}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Liquidación mínima dialog */}
      <Dialog open={liquidationOpen} onOpenChange={setLiquidationOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HandCoins className="h-4 w-4" />
              Liquidación mínima del grupo
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const transfers = simplifyDebts(balances)
            const totalSpent = expenses.reduce((a, e) => a + e.total, 0)
            const shareText = transfers.length === 0
              ? "✅ Todos en cero — sin deudas pendientes"
              : transfers.map(t =>
                  `${getName(t.from)} → ${getName(t.to)}: ${formatCurrency(t.amount)}`
                ).join("\n")

            return (
              <div className="space-y-4 mt-1">
                {/* Period summary */}
                <div className="rounded-lg bg-muted/40 p-3 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground font-mono uppercase">Resumen del período</p>
                  <div className="flex justify-between text-xs">
                    <span>Total gastado</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(totalSpent)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Nº de gastos</span>
                    <span className="font-semibold">{expenses.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Miembros</span>
                    <span className="font-semibold">{group.members.length}</span>
                  </div>
                </div>

                {/* Minimum transfers */}
                <div className="space-y-2">
                  <p className="text-xs font-medium">
                    {transfers.length === 0
                      ? "Sin transferencias necesarias"
                      : `${transfers.length} transferencia${transfers.length > 1 ? "s" : ""} para saldar todo`}
                  </p>
                  {transfers.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-2xl">🎉</p>
                      <p className="text-sm text-muted-foreground mt-1">¡Todos en cero!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {transfers.map((t, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                            {getName(t.from)[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium">
                              {getName(t.from)} → {getName(t.to)}
                            </p>
                          </div>
                          <p className="text-sm font-bold tabular-nums text-destructive shrink-0">
                            {formatCurrency(t.amount)}
                          </p>
                          <button
                            title="Copiar enlace de pago"
                            onClick={() => {
                              const payload = btoa(JSON.stringify({
                                from: getName(t.from),
                                to: getName(t.to),
                                amount: t.amount,
                                concept: `Deuda del grupo "${group.name}"`,
                                currency: "EUR",
                              }))
                              const url = `${window.location.origin}/pay/${payload}`
                              navigator.clipboard.writeText(url)
                              toast.success("Enlace copiado al portapapeles")
                            }}
                            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Share button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                  onClick={() => {
                    const text = `💰 Liquidación del grupo "${group.name}"\n\n` +
                      `Total gastado: ${formatCurrency(totalSpent)}\n` +
                      `${expenses.length} gastos · ${group.members.length} personas\n\n` +
                      `Transferencias mínimas:\n${shareText}`
                    if (navigator.share) {
                      navigator.share({ title: `Liquidación ${group.name}`, text })
                    } else {
                      navigator.clipboard.writeText(text)
                      toast.success("Copiado al portapapeles")
                    }
                  }}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  Compartir resumen
                </Button>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Settle dialog */}
      <Dialog open={!!settleDialog} onOpenChange={(o) => { if (!o) setSettleDialog(null) }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HandCoins className="h-4 w-4" />
              Registrar pago
            </DialogTitle>
          </DialogHeader>
          {settleDialog && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
                <span className="font-medium">{getName(settleDialog.fromUid)}</span>
                <span className="text-muted-foreground"> paga a </span>
                <span className="font-medium">{getName(settleDialog.toUid)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Monto</Label>
                  <Input type="number" step="0.01" className="tabular-nums"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Moneda</Label>
                  <Select value={settleCurrency} onValueChange={setSettleCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Nota (opcional)</Label>
                <Input placeholder="Transferencia, efectivo..." value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handleSettle} disabled={settleDebt.isPending}>
                Confirmar pago
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Group detail ─────────────────────────────────────────────────────────────

function GroupDetail({
  group: initialGroup, onBack, onGroupUpdated,
}: {
  group: Group
  onBack: () => void
  onGroupUpdated: (g: Group) => void
}) {
  const { user } = useAuth()
  const { data: categories = [] } = useCategories()
  const { data: expenses = [], isLoading } = useGroupExpenses(initialGroup.id)
  const { data: settlements = [] } = useGroupSettlements(initialGroup.id)
  const addExpense = useAddGroupExpense()
  const updateExpense = useUpdateGroupExpense()
  const deleteExpense = useDeleteGroupExpense()
  const leaveGroup = useLeaveGroup()
  const refreshCode = useRefreshInviteCode()
  const updateGroup = useUpdateGroup()
  const archiveGroup = useArchiveGroup()

  const [tab, setTab] = useState<"gastos" | "balance" | "stats" | "miembros">("gastos")
  const [addOpen, setAddOpen] = useState(false)
  const [editExpense, setEditExpense] = useState<GroupExpense | null>(null)
  const [formSaving, setFormSaving] = useState(false)

  // Group editing
  const [editGroupOpen, setEditGroupOpen] = useState(false)
  const [editGroupName, setEditGroupName] = useState(initialGroup.name)
  const [editGroupEmoji, setEditGroupEmoji] = useState(initialGroup.emoji)

  // Invite code
  const [copiedCode, setCopiedCode] = useState(false)

  // Filters
  const [search, setSearch] = useState("")
  const [filterCat, setFilterCat] = useState("__all__")
  const [filterPaidBy, setFilterPaidBy] = useState("__all__")
  const [filterMonth, setFilterMonth] = useState("__all__")
  const [showFilters, setShowFilters] = useState(false)

  const group = initialGroup // use this directly (refreshed by React Query via onGroupUpdated)

  const isAdmin = group.adminUid === user?.uid
  const currentUid = user?.uid ?? ""
  const allCats = categories.length > 0 ? categories : DEFAULT_CATEGORIES
  const inviteCode = group.inviteCodes?.[0] ?? "—"
  const totalSpent = expenses.reduce((a, e) => a + e.total, 0)

  // Add form
  const [addForm, setAddForm] = useState<ExpenseFormState>(() => emptyExpenseForm(group.members))

  // Edit form (derived from selected expense)
  const [editForm, setEditForm] = useState<ExpenseFormState>(() => emptyExpenseForm(group.members))

  function openEdit(e: GroupExpense) {
    setEditForm({
      merchant: e.merchant,
      date: toDate(e.date).toISOString().split("T")[0],
      total: e.total.toString(),
      subtotal: e.subtotal?.toString() ?? "",
      tax: e.tax?.toString() ?? "0",
      category: e.category,
      paymentMethod: e.paymentMethod ?? "",
      currency: e.currency,
      notes: e.notes ?? "",
      splitType: e.splitType,
      splitWith: e.splitWith,
      customShares: Object.fromEntries(
        group.members.map((m) => [m.uid, (e.customShares?.[m.uid] ?? "").toString()])
      ),
    })
    setEditExpense(e)
  }

  async function handleAddExpense() {
    if (!addForm.merchant || !addForm.total) { toast.error("Completa comercio y monto"); return }
    const totalAmt = parseFloat(addForm.total) || 0
    if (addForm.splitType === "custom") {
      const sum = addForm.splitWith.reduce((a, uid) => a + (parseFloat(addForm.customShares[uid] ?? "0") || 0), 0)
      if (Math.abs(sum - totalAmt) > 0.01) { toast.error("La suma de partes no coincide con el total"); return }
    }
    setFormSaving(true)
    try {
      await addExpense.mutateAsync({
        groupId: group.id,
        input: {
          merchant: addForm.merchant, date: new Date(addForm.date + "T12:00:00"),
          items: [], subtotal: parseFloat(addForm.subtotal) || totalAmt,
          tax: parseFloat(addForm.tax) || 0, total: totalAmt,
          paymentMethod: addForm.paymentMethod || null, reference: null,
          category: addForm.category, currency: addForm.currency,
          notes: addForm.notes, tags: [], receiptImageUrl: null,
        },
        splitWith: addForm.splitWith,
        splitType: addForm.splitType,
        customShares: addForm.splitType === "custom"
          ? Object.fromEntries(addForm.splitWith.map((uid) => [uid, parseFloat(addForm.customShares[uid] ?? "0") || 0]))
          : undefined,
      })
      toast.success("Gasto añadido")
      setAddOpen(false)
      setAddForm(emptyExpenseForm(group.members))
    } catch { toast.error("Error al añadir gasto") }
    finally { setFormSaving(false) }
  }

  async function handleUpdateExpense() {
    if (!editExpense) return
    if (!editForm.merchant || !editForm.total) { toast.error("Completa comercio y monto"); return }
    const totalAmt = parseFloat(editForm.total) || 0
    if (editForm.splitType === "custom") {
      const sum = editForm.splitWith.reduce((a, uid) => a + (parseFloat(editForm.customShares[uid] ?? "0") || 0), 0)
      if (Math.abs(sum - totalAmt) > 0.01) { toast.error("La suma de partes no coincide con el total"); return }
    }
    setFormSaving(true)
    try {
      await updateExpense.mutateAsync({
        groupId: group.id, expenseId: editExpense.id,
        input: {
          merchant: editForm.merchant, date: new Date(editForm.date + "T12:00:00"),
          items: [], subtotal: parseFloat(editForm.subtotal) || totalAmt,
          tax: parseFloat(editForm.tax) || 0, total: totalAmt,
          paymentMethod: editForm.paymentMethod || null, reference: null,
          category: editForm.category, currency: editForm.currency,
          notes: editForm.notes, tags: [], receiptImageUrl: null,
        },
        splitWith: editForm.splitWith,
        splitType: editForm.splitType,
        customShares: editForm.splitType === "custom"
          ? Object.fromEntries(editForm.splitWith.map((uid) => [uid, parseFloat(editForm.customShares[uid] ?? "0") || 0]))
          : undefined,
      })
      toast.success("Gasto actualizado")
      setEditExpense(null)
    } catch { toast.error("Error al actualizar") }
    finally { setFormSaving(false) }
  }

  async function handleDelete(e: GroupExpense) {
    if (!confirm("¿Eliminar este gasto?")) return
    try {
      await deleteExpense.mutateAsync({ groupId: group.id, expenseId: e.id })
      toast.success("Gasto eliminado")
    } catch { toast.error("Error al eliminar") }
  }

  async function handleLeave() {
    if (!confirm(`¿Salir del grupo "${group.name}"?`)) return
    try {
      await leaveGroup.mutateAsync(group.id)
      toast.success("Saliste del grupo")
      onBack()
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error al salir") }
  }

  async function handleArchive() {
    if (!confirm(`¿Archivar el grupo "${group.name}"? Seguirá visible en grupos archivados.`)) return
    try {
      await archiveGroup.mutateAsync(group.id)
      toast.success("Grupo archivado")
      onBack()
    } catch { toast.error("Error al archivar") }
  }

  async function handleUpdateGroup() {
    if (!editGroupName.trim()) { toast.error("El nombre no puede estar vacío"); return }
    try {
      await updateGroup.mutateAsync({ groupId: group.id, name: editGroupName.trim(), emoji: editGroupEmoji })
      toast.success("Grupo actualizado")
      setEditGroupOpen(false)
      onGroupUpdated({ ...group, name: editGroupName.trim(), emoji: editGroupEmoji })
    } catch { toast.error("Error al actualizar el grupo") }
  }

  function copyCode() {
    navigator.clipboard.writeText(inviteCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
    toast.success("Código copiado")
  }

  // Available months from expenses
  const availableMonths = useMemo(() => {
    const set = new Set<string>()
    expenses.forEach((e) => set.add(format(e.date.toDate(), "yyyy-MM")))
    return Array.from(set).sort().reverse()
  }, [expenses])

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (search && !e.merchant.toLowerCase().includes(search.toLowerCase())) return false
      if (filterCat !== "__all__" && e.category !== filterCat) return false
      if (filterPaidBy !== "__all__" && e.paidByUid !== filterPaidBy) return false
      if (filterMonth !== "__all__") {
        const monthKey = format(e.date.toDate(), "yyyy-MM")
        if (monthKey !== filterMonth) return false
      }
      return true
    })
  }, [expenses, search, filterCat, filterPaidBy, filterMonth])

  const activeFilters = [
    search, filterCat !== "__all__", filterPaidBy !== "__all__", filterMonth !== "__all__"
  ].filter(Boolean).length

  const myBalance = computeBalances(expenses, settlements, group.members)[currentUid] ?? 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{group.emoji}</span>
            <h1 className="font-serif text-xl truncate">{group.name}</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            {group.members.length} miembros · {formatCurrency(totalSpent)} total
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" className="gap-1.5 h-8" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Añadir
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isAdmin && (
                <DropdownMenuItem onClick={() => setEditGroupOpen(true)}>
                  <Pencil className="h-4 w-4" />
                  Editar grupo
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={copyCode}>
                <Copy className="h-4 w-4" />
                Copiar código de invitación
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLeave} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" />
                Salir del grupo
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={handleArchive} className="text-muted-foreground">
                  <Archive className="h-4 w-4" />
                  Archivar grupo
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Balance quick-pill */}
      {Math.abs(myBalance) > 0.01 && (
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs cursor-pointer ${
            myBalance > 0 ? "bg-green-500/10 text-green-700" : "bg-destructive/10 text-destructive"
          }`}
          onClick={() => setTab("balance")}
        >
          <TrendingUp className="h-3.5 w-3.5 shrink-0" />
          <span>
            {myBalance > 0
              ? `Te deben ${formatCurrency(myBalance)} en total · Ver balance`
              : `Debes ${formatCurrency(Math.abs(myBalance))} en total · Ver balance`}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {(["gastos", "balance", "stats", "miembros"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-1.5 text-[11px] font-medium capitalize transition-colors ${tab === t ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
            {t === "stats" ? "Análisis" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Gastos tab ── */}
      {tab === "gastos" && (
        <div className="space-y-3">
          {/* Search + filter bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar gasto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              variant={activeFilters > 0 ? "default" : "outline"}
              size="sm" className="h-8 gap-1.5 shrink-0"
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {activeFilters > 0 ? `${activeFilters} filtro${activeFilters > 1 ? "s" : ""}` : "Filtros"}
            </Button>
          </div>

          {/* Filter dropdowns */}
          {showFilters && (
            <div className="grid grid-cols-3 gap-2">
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Mes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos los meses</SelectItem>
                  {availableMonths.map((m) => (
                    <SelectItem key={m} value={m}>
                      {format(new Date(m + "-01"), "MMM yyyy", { locale: es })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas las categorías</SelectItem>
                  {allCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterPaidBy} onValueChange={setFilterPaidBy}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pagó" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Cualquiera</SelectItem>
                  {group.members.map((m) => (
                    <SelectItem key={m.uid} value={m.uid}>
                      {m.uid === currentUid ? "Yo" : m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Results count */}
          {(activeFilters > 0 || search) && (
            <p className="text-xs text-muted-foreground">
              {filteredExpenses.length} de {expenses.length} gastos
              {activeFilters > 0 && (
                <button
                  onClick={() => { setSearch(""); setFilterCat("__all__"); setFilterPaidBy("__all__"); setFilterMonth("__all__") }}
                  className="ml-2 text-primary hover:underline"
                >
                  Limpiar filtros
                </button>
              )}
            </p>
          )}

          {/* Expense list */}
          {isLoading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{expenses.length === 0 ? "Sin gastos en el grupo" : "Sin resultados"}</p>
              <p className="text-xs mt-1">
                {expenses.length === 0 ? "Añade el primero con el botón de arriba" : "Prueba cambiando los filtros"}
              </p>
            </div>
          ) : filteredExpenses.map((e) => {
            const cat = allCats.find((c) => c.id === e.category)
            const isMyExpense = e.paidByUid === currentUid
            const canEdit = isMyExpense || isAdmin
            const myShare = e.splitType === "equal" && e.splitWith.length > 0
              ? e.total / e.splitWith.length
              : e.splitType === "custom" && e.customShares
              ? (e.customShares[currentUid] ?? 0)
              : e.total
            const splitLabel = e.splitType === "equal" ? `÷${e.splitWith.length}` : e.splitType === "custom" ? "⚖️" : null

            return (
              <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-accent/20 transition-colors group">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
                  style={{ backgroundColor: `${cat?.color ?? "#6b7280"}20` }}>
                  {cat?.icon ?? "📦"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.merchant}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <p className="text-xs text-muted-foreground">
                      {isMyExpense ? "Tú pagaste" : `Pagó ${e.paidByName}`}
                    </p>
                    {splitLabel && <Badge variant="outline" className="text-[10px] h-4 px-1">{splitLabel}</Badge>}
                    <span className="text-[10px] text-muted-foreground">
                      {format(toDate(e.date), "d MMM", { locale: es })}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="tabular-nums text-sm font-semibold">{formatCurrency(e.total, e.currency)}</p>
                  {e.splitType !== "full" && e.splitWith.length > 1 && (
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {isMyExpense
                        ? `cobras ${formatCurrency(e.total - myShare, e.currency)}`
                        : `tu parte ${formatCurrency(myShare, e.currency)}`}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all ml-1 shrink-0">
                  <CommentButton groupId={group.id} expenseId={e.id} expenseName={e.merchant} />
                  <AuditLogButton groupId={group.id} expenseId={e.id} merchant={e.merchant} />
                  {canEdit && (
                    <>
                      <button onClick={() => openEdit(e)} className="text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(e)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Balance tab ── */}
      {tab === "balance" && user && (
        <BalanceTab group={group} expenses={expenses} settlements={settlements} currentUid={currentUid} />
      )}

      {/* ── Stats tab ── */}
      {tab === "stats" && (
        <StatsTab expenses={filteredExpenses.length < expenses.length ? filteredExpenses : expenses} group={group} categories={categories} />
      )}

      {/* ── Miembros tab ── */}
      {tab === "miembros" && (
        <div className="space-y-4">
          {/* Member list */}
          <div className="space-y-2">
            {group.members.map((m) => {
              const balance = computeBalances(expenses, settlements, group.members)[m.uid] ?? 0
              return (
                <div key={m.uid} className="flex items-center gap-3 p-3 rounded-xl border">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0">
                    {m.displayName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">
                        {m.displayName}{m.uid === currentUid && <span className="text-muted-foreground font-normal"> (tú)</span>}
                      </p>
                      {m.role === "admin" && <Crown className="h-3 w-3 text-amber-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-semibold tabular-nums ${
                      balance > 0.01 ? "text-green-600" : balance < -0.01 ? "text-destructive" : "text-muted-foreground"
                    }`}>
                      {Math.abs(balance) < 0.01 ? "—" : `${balance > 0 ? "+" : ""}${formatCurrency(balance)}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {Math.abs(balance) < 0.01 ? "en cero" : balance > 0 ? "le deben" : "debe"}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Invite code */}
          <Card>
            <CardContent className="pt-4 pb-4 space-y-3">
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Código de invitación</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-xl font-bold tracking-widest text-center py-2.5 bg-muted rounded-xl">
                  {inviteCode}
                </code>
                <Button size="icon" variant="outline" onClick={copyCode}>
                  {copiedCode ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
                {isAdmin && (
                  <Button size="icon" variant="outline" onClick={async () => {
                    const code = await refreshCode.mutateAsync(group.id)
                    toast.success(`Nuevo código: ${code}`)
                  }} title="Regenerar código">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Comparte este código para que otros se unan al grupo</p>
            </CardContent>
          </Card>

          {/* Admin actions */}
          {isAdmin && (
            <div className="space-y-2">
              <Button variant="outline" className="w-full gap-2" onClick={() => setEditGroupOpen(true)}>
                <Pencil className="h-4 w-4" />
                Editar nombre e ícono
              </Button>
              <Button variant="outline" className="w-full gap-2 text-muted-foreground"
                onClick={handleArchive} disabled={archiveGroup.isPending}>
                <Archive className="h-4 w-4" />
                Archivar grupo
              </Button>
            </div>
          )}

          <Button variant="outline"
            className="w-full gap-2 text-destructive hover:text-destructive border-destructive/30"
            onClick={handleLeave} disabled={leaveGroup.isPending}>
            <LogOut className="h-4 w-4" />
            Salir del grupo
          </Button>
        </div>
      )}

      {/* ── Add expense dialog ── */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setAddForm(emptyExpenseForm(group.members)) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Añadir gasto al grupo</DialogTitle>
          </DialogHeader>
          <ExpenseForm
            form={addForm} setForm={setAddForm}
            group={group} categories={categories}
            currentUid={currentUid}
            onSave={handleAddExpense} saving={formSaving}
            title="Añadir gasto"
          />
        </DialogContent>
      </Dialog>

      {/* ── Edit expense dialog ── */}
      <Dialog open={!!editExpense} onOpenChange={(o) => { if (!o) setEditExpense(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar gasto</DialogTitle>
          </DialogHeader>
          <ExpenseForm
            form={editForm} setForm={setEditForm}
            group={group} categories={categories}
            currentUid={currentUid}
            onSave={handleUpdateExpense} saving={formSaving}
            title="Guardar cambios"
          />
        </DialogContent>
      </Dialog>

      {/* ── Edit group dialog ── */}
      <Dialog open={editGroupOpen} onOpenChange={setEditGroupOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Ícono</Label>
              <div className="flex flex-wrap gap-2">
                {GROUP_EMOJIS.map((e) => (
                  <button key={e} onClick={() => setEditGroupEmoji(e)}
                    className={`text-2xl p-2 rounded-lg border transition-colors ${editGroupEmoji === e ? "border-foreground bg-accent" : "border-transparent hover:border-border"}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={handleUpdateGroup} disabled={updateGroup.isPending}>
              Guardar cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function GroupsPage() {
  const { data: groups = [], isLoading } = useMyGroups()
  const createGroup = useCreateGroup()
  const joinGroup = useJoinGroup()
  const unarchiveGroup = useUnarchiveGroup()

  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [groupEmoji, setGroupEmoji] = useState("👨‍👩‍👧‍👦")
  const [joinCode, setJoinCode] = useState("")
  const [newGroupCode, setNewGroupCode] = useState<string | null>(null)
  const [copiedNewCode, setCopiedNewCode] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const activeGroups   = groups.filter((g) => !(g as Group & { archived?: boolean }).archived)
  const archivedGroups = groups.filter((g) => !!(g as Group & { archived?: boolean }).archived)

  async function handleCreate() {
    if (!groupName.trim()) { toast.error("Ponle un nombre al grupo"); return }
    try {
      const { inviteCode } = await createGroup.mutateAsync({ name: groupName, emoji: groupEmoji })
      setNewGroupCode(inviteCode)
      toast.success("Grupo creado")
      setGroupName("")
    } catch { toast.error("Error al crear grupo") }
  }

  async function handleJoin() {
    if (!joinCode.trim()) { toast.error("Ingresa un código de invitación"); return }
    try {
      const { groupName: name } = await joinGroup.mutateAsync(joinCode)
      toast.success(`Te uniste a "${name}"`)
      setJoinOpen(false)
      setJoinCode("")
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error al unirse") }
  }

  if (selectedGroup) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <GroupDetail
          group={selectedGroup}
          onBack={() => setSelectedGroup(null)}
          onGroupUpdated={(g) => setSelectedGroup(g)}
        />
      </div>
    )
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl">Grupos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{activeGroups.length} activo{activeGroups.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setJoinOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            Unirse
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Crear
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : activeGroups.length === 0 && archivedGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center text-3xl">👨‍👩‍👧‍👦</div>
          <div>
            <p className="font-semibold">Sin grupos todavía</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Crea un grupo con tu familia o amigos para controlar gastos compartidos y saber quién debe qué
            </p>
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            <Button variant="outline" onClick={() => setJoinOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Unirme con código
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Crear grupo
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {activeGroups.map((group) => (
            <button key={group.id} onClick={() => setSelectedGroup(group)}
              className="w-full text-left rounded-xl border p-4 hover:bg-accent/30 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{group.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{group.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {group.members.length} miembros · {group.members.map((m) => m.displayName.split(" ")[0]).join(", ")}
                  </p>
                </div>
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </button>
          ))}

          {/* Archived groups */}
          {archivedGroups.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
              >
                {showArchived ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                <Archive className="h-3.5 w-3.5" />
                Archivados ({archivedGroups.length})
              </button>
              {showArchived && archivedGroups.map((group) => (
                <div key={group.id} className="flex items-center gap-3 p-4 rounded-xl border border-dashed bg-muted/30 mb-2">
                  <span className="text-2xl opacity-50">{group.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-muted-foreground truncate">{group.name}</p>
                    <p className="text-xs text-muted-foreground">{group.members.length} miembros · Archivado</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0"
                    onClick={() => unarchiveGroup.mutateAsync(group.id).then(() => toast.success("Grupo restaurado"))}>
                    <ArchiveRestore className="h-3 w-3" />
                    Restaurar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create group dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setNewGroupCode(null) } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Crear grupo</DialogTitle>
          </DialogHeader>
          {newGroupCode ? (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">¡Grupo creado! 🎉</p>
                <p className="text-xs text-muted-foreground">Comparte este código para invitar a otros miembros</p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-2xl font-bold tracking-widest text-center py-3 bg-muted rounded-xl">
                  {newGroupCode}
                </code>
                <Button size="icon" variant="outline" onClick={() => {
                  navigator.clipboard.writeText(newGroupCode)
                  setCopiedNewCode(true)
                  setTimeout(() => setCopiedNewCode(false), 2000)
                }}>
                  {copiedNewCode ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Button className="w-full" onClick={() => { setCreateOpen(false); setNewGroupCode(null) }}>
                Ir al grupo
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nombre del grupo *</Label>
                <Input placeholder="Familia, Viaje NY, Casa..." value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Ícono</Label>
                <div className="flex flex-wrap gap-2">
                  {GROUP_EMOJIS.map((e) => (
                    <button key={e} onClick={() => setGroupEmoji(e)}
                      className={`text-2xl p-2 rounded-lg border transition-colors ${groupEmoji === e ? "border-foreground bg-accent" : "border-transparent hover:border-border"}`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={createGroup.isPending}>
                {createGroup.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                Crear grupo
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Join group dialog */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Unirse a un grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Código de invitación</Label>
              <Input
                placeholder="ABC123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="font-mono text-center text-lg tracking-widest uppercase"
                maxLength={6}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">Pídele el código al administrador del grupo</p>
            </div>
            <Button className="w-full" onClick={handleJoin} disabled={joinGroup.isPending || joinCode.length < 5}>
              {joinGroup.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              Unirme
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
