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
  type Group, type GroupExpense, type GroupSettlement, type GroupType,
} from "@/hooks/use-groups"
import { formatCurrency, toDate } from "@/lib/utils"
import { format, startOfMonth, endOfMonth, subMonths, isSameMonth } from "date-fns"
import { es } from "date-fns/locale"
import { PAYMENT_METHODS, CURRENCIES, DEFAULT_CATEGORIES } from "@/lib/constants"
import { authFetch } from "@/lib/client-fetch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { GroupChecklists } from "@/components/groups/group-checklists"
import { GroupFolders } from "@/components/groups/group-folders"
import { CommentsDialog } from "@/components/groups/group-comments"
import { AuditLogDialog2 as AuditLogDialog } from "@/components/groups/expense-audit-log"
import { GroupEvents } from "@/components/groups/group-events"
import { GroupPolls } from "@/components/groups/group-polls"
import { ExpenseReactions } from "@/components/groups/expense-reactions"
import { GroupNotes } from "@/components/groups/group-notes"
import { GroupWishlist } from "@/components/groups/group-wishlist"
import { GroupBets } from "@/components/groups/group-bets"
import {
  Users, Plus, LogOut, Copy, RefreshCw, Trash2, Archive, ArchiveRestore,
  Receipt, UserPlus, Crown, Check, Pencil, MoreVertical,
  Search, SlidersHorizontal, TrendingUp, HandCoins, History,
  ChevronDown, ChevronUp, BarChart2, X, Share2, Download, Bell,
  Target, Link as LinkIcon, ChevronLeft, ChevronRight, Scale, LayoutGrid,
  Calendar, ClipboardList, Gift, FolderOpen, MessageCircle,
} from "lucide-react"
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip,
  CartesianGrid,
} from "recharts"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/ui/empty-state"

// ─── Constants ─────────────────────────────────────────────────────────────────

const GROUP_EMOJIS = ["👨‍👩‍👧‍👦", "👫", "🏠", "💼", "🎓", "✈️", "🎉", "💰", "🍽️", "🛒", "🚗", "🏋️", "🏖️", "🎮", "🐾"]

const GROUP_TYPES: { value: GroupType; label: string; emoji: string }[] = [
  { value: "casa",    label: "Casa",    emoji: "🏠" },
  { value: "amigos",  label: "Amigos",  emoji: "👥" },
  { value: "trabajo", label: "Trabajo", emoji: "💼" },
  { value: "viaje",   label: "Viaje",   emoji: "✈️" },
  { value: "otro",    label: "Otro",    emoji: "📦" },
]

function GroupTypeBadge({ type }: { type?: GroupType }) {
  if (!type) return null
  const meta = GROUP_TYPES.find((t) => t.value === type)
  if (!meta) return null
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {meta.emoji} {meta.label}
    </span>
  )
}

// ─── Group balance badge (for the list cards) ────────────────────────────────

function GroupBalanceBadge({ groupId, members, currentUid }: {
  groupId: string
  members: Group["members"]
  currentUid: string
}) {
  const { data: expenses = [] } = useGroupExpenses(groupId)
  const { data: settlements = [] } = useGroupSettlements(groupId)
  const balance = computeBalances(expenses, settlements, members)[currentUid] ?? 0
  if (Math.abs(balance) < 0.01) return null
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums shrink-0",
      balance > 0 ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-destructive/15 text-destructive"
    )}>
      {balance > 0 ? "+" : ""}{balance > 0 ? `te deben ${formatCurrency(balance)}` : `debes ${formatCurrency(Math.abs(balance))}`}
    </span>
  )
}

// ─── Group export utilities ───────────────────────────────────────────────────

async function exportGroupCSV(group: Group, expenses: GroupExpense[], settlements: GroupSettlement[]) {
  const getName = (uid: string) => group.members.find((m) => m.uid === uid)?.displayName ?? uid
  const rows: string[][] = [
    ["Fecha", "Comercio", "Categoría", "Total", "Moneda", "Pagado por", "División", "Notas"],
    ...expenses.map((e) => [
      format(e.date.toDate(), "yyyy-MM-dd"),
      e.merchant,
      e.category,
      e.total.toString(),
      e.currency,
      getName(e.paidByUid),
      e.splitType,
      e.notes ?? "",
    ]),
    [],
    ["Pagos registrados"],
    ["Fecha", "De", "A", "Monto", "Moneda", "Nota"],
    ...settlements.map((s) => [
      format(s.date.toDate(), "yyyy-MM-dd"),
      getName(s.fromUid),
      getName(s.toUid),
      s.amount.toString(),
      s.currency,
      s.note ?? "",
    ]),
  ]
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `grupo-${group.name.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

async function exportGroupPDF(group: Group, expenses: GroupExpense[], settlements: GroupSettlement[], balances: Record<string, number>) {
  const { default: jsPDF } = await import("jspdf")
  const { default: autoTable } = await import("jspdf-autotable")

  const getName = (uid: string) => group.members.find((m) => m.uid === uid)?.displayName ?? uid
  const doc = new jsPDF()

  // Title
  doc.setFontSize(16)
  doc.text(`Grupo: ${group.emoji} ${group.name}`, 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(`Exportado: ${format(new Date(), "d MMMM yyyy", { locale: es })}`, 14, 25)
  doc.setTextColor(0)

  // Summary
  const totalSpent = expenses.reduce((a, e) => a + e.total, 0)
  doc.setFontSize(11)
  doc.text(`Total gastado: ${formatCurrency(totalSpent)} · ${expenses.length} gastos · ${group.members.length} miembros`, 14, 34)

  // Balances table
  autoTable(doc, {
    startY: 40,
    head: [["Miembro", "Balance"]],
    body: group.members.map((m) => {
      const b = balances[m.uid] ?? 0
      return [m.displayName, Math.abs(b) < 0.01 ? "En cero ✓" : b > 0 ? `+${formatCurrency(b)} (le deben)` : `${formatCurrency(b)} (debe)`]
    }),
    headStyles: { fillColor: [30, 30, 30] },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  })

  // Expenses table
  const afterBalances = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  doc.setFontSize(11)
  doc.text("Gastos del grupo", 14, afterBalances)

  autoTable(doc, {
    startY: afterBalances + 4,
    head: [["Fecha", "Comercio", "Total", "Pagado por", "División"]],
    body: expenses.map((e) => [
      format(e.date.toDate(), "d/M/yy"),
      e.merchant.slice(0, 24),
      formatCurrency(e.total, e.currency),
      getName(e.paidByUid),
      e.splitType === "equal" ? `÷${e.splitWith.length}` : e.splitType === "custom" ? "⚖️" : "Solo",
    ]),
    headStyles: { fillColor: [30, 30, 30] },
    styles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 20 }, 2: { cellWidth: 24 }, 3: { cellWidth: 30 }, 4: { cellWidth: 18 } },
    margin: { left: 14, right: 14 },
  })

  // Settlements
  if (settlements.length > 0) {
    const afterExp = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
    doc.setFontSize(11)
    doc.text("Pagos / liquidaciones", 14, afterExp)
    autoTable(doc, {
      startY: afterExp + 4,
      head: [["Fecha", "De", "A", "Monto", "Nota"]],
      body: settlements.map((s) => [
        format(s.date.toDate(), "d/M/yy"),
        getName(s.fromUid),
        getName(s.toUid),
        formatCurrency(s.amount, s.currency),
        s.note ?? "",
      ]),
      headStyles: { fillColor: [30, 30, 30] },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    })
  }

  doc.save(`grupo-${group.name.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.pdf`)
}

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
      // note: "percentage" splits are converted to "custom" + customShares at save time
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
  splitType: "equal" | "full" | "custom" | "percentage"
  splitWith: string[]
  customShares: Record<string, string>
  percentageShares: Record<string, string>
}

function emptyExpenseForm(members: Group["members"]): ExpenseFormState {
  return {
    merchant: "", date: new Date().toISOString().split("T")[0],
    total: "", subtotal: "", tax: "0",
    category: "otros", paymentMethod: "", currency: "USD", notes: "",
    splitType: "equal",
    splitWith: members.map((m) => m.uid),
    customShares: Object.fromEntries(members.map((m) => [m.uid, ""])),
    percentageShares: Object.fromEntries(members.map((m) => [m.uid, ""])),
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
          <Input type="number" inputMode="decimal" step="0.01" placeholder="0.00" value={form.total}
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
        <div className="grid grid-cols-2 gap-1.5">
          {(["equal", "percentage", "custom", "full"] as const).map((type) => (
            <button key={type} onClick={() => setForm({ ...form, splitType: type })}
              className={`rounded-lg border p-2 text-[11px] text-center transition-colors leading-tight ${form.splitType === type ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground hover:border-muted-foreground"}`}>
              {type === "equal" ? "÷ Iguales" : type === "percentage" ? "% Porcentaje" : type === "custom" ? "⚖️ Monto fijo" : "👤 Solo yo"}
            </button>
          ))}
        </div>

        {form.splitType !== "full" && (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">¿Quiénes participan?</p>
            {group.members.map((m) => {
              const checked = form.splitWith.includes(m.uid)
              const pct = parseFloat(form.percentageShares[m.uid] ?? "0") || 0
              const pctAmount = totalAmt * (pct / 100)
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
                    <Input type="number" inputMode="decimal" step="0.01" min={0}
                      value={form.customShares[m.uid] ?? ""}
                      onChange={(e) => setForm({
                        ...form,
                        customShares: { ...form.customShares, [m.uid]: e.target.value },
                      })}
                      className="w-24 h-7 text-xs tabular-nums text-right" placeholder="0.00" />
                  )}
                  {form.splitType === "percentage" && checked && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Input type="number" inputMode="decimal" step="1" min={0} max={100}
                        value={form.percentageShares[m.uid] ?? ""}
                        onChange={(e) => setForm({
                          ...form,
                          percentageShares: { ...form.percentageShares, [m.uid]: e.target.value },
                        })}
                        className="w-16 h-7 text-xs tabular-nums text-right" placeholder="0" />
                      <span className="text-[11px] text-muted-foreground">%</span>
                      {totalAmt > 0 && pct > 0 && (
                        <span className="text-[11px] text-muted-foreground tabular-nums w-14 text-right">
                          {formatCurrency(pctAmount, form.currency)}
                        </span>
                      )}
                    </div>
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

            {form.splitType === "percentage" && (() => {
              const pctSum = form.splitWith.reduce((a, uid) => a + (parseFloat(form.percentageShares[uid] ?? "0") || 0), 0)
              const pctOk = Math.abs(pctSum - 100) < 0.01
              return (
                <div className="pt-1 border-t flex items-center justify-between">
                  <button
                    onClick={() => {
                      const n = form.splitWith.length
                      if (!n) return
                      const base = Math.floor(100 / n)
                      const remainder = 100 - base * n
                      const shares = form.splitWith.reduce((acc, uid, i) => {
                        acc[uid] = String(i === 0 ? base + remainder : base)
                        return acc
                      }, {} as Record<string, string>)
                      setForm({ ...form, percentageShares: { ...form.percentageShares, ...shares } })
                    }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Distribuir igualmente
                  </button>
                  <span className={`text-[11px] tabular-nums font-medium ${pctOk ? "text-green-600" : "text-destructive"}`}>
                    {pctOk ? "✓ 100%" : `${pctSum.toFixed(0)}% / 100%`}
                  </span>
                </div>
              )
            })()}
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
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
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
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-4 py-2">Categoría</th>
                  <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-2 py-2">Txns</th>
                  <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-2 py-2">%</th>
                  <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-4 py-2">Total</th>
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
  const [deleteSettlementTarget, setDeleteSettlementTarget] = useState<GroupSettlement | null>(null)

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
      <ConfirmDialog
        open={!!deleteSettlementTarget}
        onOpenChange={(o) => { if (!o) setDeleteSettlementTarget(null) }}
        title="¿Eliminar este pago?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={async () => {
          if (!deleteSettlementTarget) return
          try {
            await deleteSettlement.mutateAsync({ groupId: group.id, settlementId: deleteSettlementTarget.id })
            toast.success("Pago eliminado")
          } catch { toast.error("Error al eliminar") }
        }}
      />

      {/* My balance hero */}
      <div className={cn(
        "rounded-2xl px-5 py-5 text-center relative overflow-hidden",
        myBalance > 0.01
          ? "bg-gradient-to-br from-green-500/15 to-emerald-500/5 border border-green-500/25"
          : myBalance < -0.01
          ? "bg-gradient-to-br from-destructive/15 to-red-500/5 border border-destructive/25"
          : "bg-gradient-to-br from-muted/60 to-muted/20 border"
      )}>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-2">Tu balance neto</p>
        <p className={cn(
          "text-4xl font-black tabular-nums tracking-tight",
          myBalance > 0.01 ? "text-green-600 dark:text-green-400"
          : myBalance < -0.01 ? "text-destructive"
          : "text-muted-foreground"
        )}>
          {myBalance > 0.01 ? "+" : ""}{formatCurrency(myBalance)}
        </p>
        <p className={cn(
          "text-xs mt-2 font-medium",
          myBalance > 0.01 ? "text-green-600/80 dark:text-green-400/80"
          : myBalance < -0.01 ? "text-destructive/70"
          : "text-muted-foreground"
        )}>
          {myBalance > 0.01 ? "te deben en total 👍"
           : myBalance < -0.01 ? "debes en total"
           : "estás en cero 🎉"}
        </p>
      </div>

      {/* Per-person debts */}
      {group.members.filter((m) => m.uid !== currentUid).length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5">Por persona</p>
          {group.members.filter((m) => m.uid !== currentUid).map((m) => {
            const balance = balances[m.uid] ?? 0
            const iOweM = balance < 0
            const amount = Math.abs(balance)
            const isZero = Math.abs(balance) < 0.01

            return (
              <div
                key={m.uid}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors",
                  isZero
                    ? "bg-muted/30 border-border/50"
                    : iOweM
                    ? "bg-destructive/5 border-destructive/20"
                    : "bg-green-500/5 border-green-500/20"
                )}
              >
                {/* Avatar */}
                <div className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                  isZero ? "bg-muted text-muted-foreground"
                  : iOweM ? "bg-destructive/15 text-destructive"
                  : "bg-green-500/15 text-green-600 dark:text-green-400"
                )}>
                  {m.displayName[0]?.toUpperCase()}
                </div>

                {/* Name + status */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{m.displayName}</p>
                  {isZero ? (
                    <p className="text-[11px] text-muted-foreground">en cero ✓</p>
                  ) : (
                    <p className={cn(
                      "text-[11px] font-medium tabular-nums",
                      iOweM ? "text-destructive" : "text-green-600 dark:text-green-400"
                    )}>
                      {iOweM ? `Le debes ${formatCurrency(amount)}` : `Te debe ${formatCurrency(amount)}`}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                {!isZero && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!iOweM && (
                      <button
                        title="Enviar recordatorio"
                        onClick={() => {
                          const msg = `Hola ${m.displayName.split(" ")[0]} 👋\n\nTe recuerdo que me debes ${formatCurrency(amount)} del grupo. Cuando puedas, ¡muchas gracias! 🙏`
                          if (navigator.share) {
                            navigator.share({ text: msg }).catch(() => {
                              navigator.clipboard.writeText(msg)
                              toast.success("Mensaje copiado")
                            })
                          } else {
                            navigator.clipboard.writeText(msg)
                            toast.success("Mensaje copiado")
                          }
                        }}
                        className="h-8 w-8 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        <Bell className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <Button
                      size="sm"
                      variant={iOweM ? "destructive" : "default"}
                      className="h-8 px-3 text-xs gap-1.5"
                      onClick={() => {
                        const fromUid = iOweM ? currentUid : m.uid
                        const toUid   = iOweM ? m.uid       : currentUid
                        setSettleDialog({ fromUid, toUid, amount })
                        setSettleAmount(amount.toFixed(2))
                        setSettleCurrency("USD")
                        setSettleNote("")
                      }}
                    >
                      <HandCoins className="h-3.5 w-3.5" />
                      Saldar
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* All-zero state */}
      {expenses.length > 0 && othersWithBalance.length === 0 && (
        <div className="rounded-2xl border bg-green-500/5 border-green-500/20 py-8 text-center">
          <p className="text-3xl mb-2">🎉</p>
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">¡Todos en cero!</p>
          <p className="text-xs text-muted-foreground mt-1">No hay deudas pendientes en el grupo.</p>
        </div>
      )}

      {expenses.length === 0 && (
        <EmptyState
          icon={Receipt}
          title="Sin gastos aún"
          description="Añade el primer gasto del grupo arriba"
          compact
        />
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
                    <p className="text-[11px] text-muted-foreground">
                      {format(s.date.toDate(), "d MMM yyyy", { locale: es })}
                      {s.note ? ` · ${s.note}` : ""}
                    </p>
                  </div>
                  <p className="text-xs font-semibold tabular-nums text-green-600 shrink-0">
                    {formatCurrency(s.amount, s.currency)}
                  </p>
                  {(s.fromUid === currentUid || s.toUid === currentUid) && (
                    <button
                      onClick={() => setDeleteSettlementTarget(s)}
                      className="md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
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
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Resumen del período</p>
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
                            onClick={async () => {
                              try {
                                const res = await authFetch("/api/pay-link", {
                                    from: getName(t.from),
                                    to: getName(t.to),
                                    amount: t.amount,
                                    concept: `Deuda del grupo "${group.name}"`,
                                    currency: "EUR",
                                  })
                                const { token } = await res.json()
                                const url = `${window.location.origin}/pay/${token}`
                                await navigator.clipboard.writeText(url)
                                toast.success("Enlace copiado al portapapeles")
                              } catch {
                                toast.error("Error al generar el enlace")
                              }
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
                  <Input type="number" inputMode="decimal" step="0.01" className="tabular-nums"
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

type ExtraTab = "stats" | "eventos" | "encuestas" | "deseos" | "retos" | "carpetas" | null

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

  const [tab, setTab] = useState<"gastos" | "balance" | "miembros" | "mas">("gastos")
  const [extraTab, setExtraTab] = useState<ExtraTab>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editExpense, setEditExpense] = useState<GroupExpense | null>(null)
  const [formSaving, setFormSaving] = useState(false)
  const [commentExpense, setCommentExpense] = useState<GroupExpense | null>(null)
  const [auditExpense, setAuditExpense] = useState<GroupExpense | null>(null)

  // Group editing
  const [editGroupOpen, setEditGroupOpen] = useState(false)
  const [editGroupName, setEditGroupName] = useState(initialGroup.name)
  const [editGroupEmoji, setEditGroupEmoji] = useState(initialGroup.emoji)
  const [editGroupDesc, setEditGroupDesc] = useState(initialGroup.description ?? "")
  const [editGroupBudget, setEditGroupBudget] = useState(initialGroup.budget?.toString() ?? "")

  // Invite code
  const [copiedCode, setCopiedCode] = useState(false)

  // Confirmations (replace native confirm())
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<GroupExpense | null>(null)
  const [leaveConfirm, setLeaveConfirm] = useState(false)
  const [archiveConfirm, setArchiveConfirm] = useState(false)

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
      percentageShares: Object.fromEntries(group.members.map((m) => [m.uid, ""])),
    })
    setEditExpense(e)
  }

  function resolveCustomShares(form: ExpenseFormState, totalAmt: number): Record<string, number> | undefined {
    if (form.splitType === "custom") {
      return Object.fromEntries(form.splitWith.map((uid) => [uid, parseFloat(form.customShares[uid] ?? "0") || 0]))
    }
    if (form.splitType === "percentage") {
      return Object.fromEntries(form.splitWith.map((uid) => {
        const pct = parseFloat(form.percentageShares[uid] ?? "0") || 0
        return [uid, parseFloat((totalAmt * pct / 100).toFixed(2))]
      }))
    }
    return undefined
  }

  async function handleAddExpense() {
    if (!addForm.merchant || !addForm.total) { toast.error("Completa comercio y monto"); return }
    const totalAmt = parseFloat(addForm.total) || 0
    if (addForm.splitType === "custom") {
      const sum = addForm.splitWith.reduce((a, uid) => a + (parseFloat(addForm.customShares[uid] ?? "0") || 0), 0)
      if (Math.abs(sum - totalAmt) > 0.01) { toast.error("La suma de partes no coincide con el total"); return }
    }
    if (addForm.splitType === "percentage") {
      const pctSum = addForm.splitWith.reduce((a, uid) => a + (parseFloat(addForm.percentageShares[uid] ?? "0") || 0), 0)
      if (Math.abs(pctSum - 100) > 0.01) { toast.error("Los porcentajes deben sumar 100%"); return }
    }
    setFormSaving(true)
    try {
      const resolvedType = addForm.splitType === "percentage" ? "custom" : addForm.splitType
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
        splitType: resolvedType,
        customShares: resolveCustomShares(addForm, totalAmt),
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
    if (editForm.splitType === "percentage") {
      const pctSum = editForm.splitWith.reduce((a, uid) => a + (parseFloat(editForm.percentageShares[uid] ?? "0") || 0), 0)
      if (Math.abs(pctSum - 100) > 0.01) { toast.error("Los porcentajes deben sumar 100%"); return }
    }
    setFormSaving(true)
    try {
      const resolvedType = editForm.splitType === "percentage" ? "custom" : editForm.splitType
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
        splitType: resolvedType,
        customShares: resolveCustomShares(editForm, totalAmt),
      })
      toast.success("Gasto actualizado")
      setEditExpense(null)
    } catch { toast.error("Error al actualizar") }
    finally { setFormSaving(false) }
  }

  function handleDelete(e: GroupExpense) {
    setDeleteExpenseTarget(e)
  }

  async function confirmDeleteExpense() {
    if (!deleteExpenseTarget) return
    try {
      await deleteExpense.mutateAsync({ groupId: group.id, expenseId: deleteExpenseTarget.id })
      toast.success("Gasto eliminado")
      setDeleteExpenseTarget(null)
    } catch { toast.error("Error al eliminar") }
  }

  async function handleLeave() {
    setLeaveConfirm(true)
  }

  async function confirmLeave() {
    try {
      await leaveGroup.mutateAsync(group.id)
      toast.success("Saliste del grupo")
      onBack()
    } catch (err) { toast.error(err instanceof Error ? err.message : "Error al salir") }
  }

  async function handleArchive() {
    setArchiveConfirm(true)
  }

  async function confirmArchive() {
    try {
      await archiveGroup.mutateAsync(group.id)
      toast.success("Grupo archivado")
      onBack()
    } catch { toast.error("Error al archivar") }
  }

  async function handleUpdateGroup() {
    if (!editGroupName.trim()) { toast.error("El nombre no puede estar vacío"); return }
    const budget = editGroupBudget ? parseFloat(editGroupBudget) : null
    try {
      await updateGroup.mutateAsync({
        groupId: group.id,
        name: editGroupName.trim(),
        emoji: editGroupEmoji,
        description: editGroupDesc.trim() || undefined,
        budget,
      })
      toast.success("Grupo actualizado")
      setEditGroupOpen(false)
      onGroupUpdated({
        ...group,
        name: editGroupName.trim(),
        emoji: editGroupEmoji,
        description: editGroupDesc.trim() || undefined,
        budget: budget ?? undefined,
      })
    } catch { toast.error("Error al actualizar el grupo") }
  }

  function copyCode() {
    navigator.clipboard.writeText(inviteCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
    toast.success("Código copiado")
  }

  async function shareInviteLink() {
    const url = `${window.location.origin}/join/${inviteCode}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Enlace copiado", { description: url })
    } catch {
      toast.error("No se pudo copiar el enlace")
    }
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

  // ── Feature 10: Monthly totals strip ──────────────────────────────────────
  const monthlyStats = useMemo(() => {
    const currentMonthKey = format(new Date(), "yyyy-MM")
    const thisMonthExpenses = expenses.filter((e) => {
      const monthKey = format(e.date.toDate(), "yyyy-MM")
      return monthKey === currentMonthKey
    })
    const totalThisMonth = thisMonthExpenses.reduce((sum, e) => sum + e.total, 0)
    const countThisMonth = thisMonthExpenses.length
    const myShareThisMonth = thisMonthExpenses
      .filter((e) => e.splitWith?.includes(currentUid))
      .reduce((sum, e) => {
        if (e.splitType === "custom" && e.customShares?.[currentUid] != null) {
          return sum + e.customShares[currentUid]
        }
        const splitCount = (e.splitWith?.length ?? 1) || 1
        return sum + e.total / splitCount
      }, 0)
    return { totalThisMonth, countThisMonth, myShareThisMonth }
  }, [expenses, currentUid])

  // Since date from first expense
  const sinceDate = useMemo(() => {
    if (expenses.length === 0) return null
    const first = [...expenses].sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime())[0]
    return first ? format(first.date.toDate(), "d MMM yyyy", { locale: es }) : null
  }, [expenses])

  return (
    <div className="space-y-4">
      {/* ── NEW HEADER ── */}
      <div className="space-y-1">
        {/* Row 1: back + title + actions */}
        <div className="flex items-start gap-2">
          {/* Back button */}
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-0.5" onClick={onBack} title="Volver a grupos">
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Title area */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl leading-none">{group.emoji}</span>
              <h1 className="font-serif text-xl truncate">{group.name}</h1>
              <GroupTypeBadge type={group.type} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
              {group.description && <span className="italic">{group.description}</span>}
              <span>{group.members.length} miembros</span>
              {sinceDate && <span>· desde {sinceDate}</span>}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" className="gap-1.5 h-8" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Añadir
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Más opciones">
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
                <DropdownMenuItem onClick={shareInviteLink}>
                  <LinkIcon className="h-4 w-4" />
                  Compartir código
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportGroupCSV(group, expenses, settlements)}>
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportGroupPDF(group, expenses, settlements, computeBalances(expenses, settlements, group.members))}>
                  <Download className="h-4 w-4" />
                  Exportar PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <DropdownMenuItem onClick={handleArchive} className="text-muted-foreground">
                    <Archive className="h-4 w-4" />
                    Archivar grupo
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleLeave} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" />
                  Salir del grupo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Budget progress bar */}
      {group.budget && group.budget > 0 && (
        <div className="rounded-xl border bg-card px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Presupuesto del grupo</span>
            </div>
            <span className={cn(
              "text-xs font-semibold tabular-nums",
              totalSpent > group.budget ? "text-destructive" : totalSpent > group.budget * 0.8 ? "text-amber-600" : "text-green-600"
            )}>
              {formatCurrency(totalSpent)} / {formatCurrency(group.budget)}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={cn(
                "h-2 rounded-full transition-all",
                totalSpent > group.budget ? "bg-destructive" : totalSpent > group.budget * 0.8 ? "bg-amber-500" : "bg-green-500"
              )}
              style={{ width: `${Math.min((totalSpent / group.budget) * 100, 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {totalSpent > group.budget
              ? `Superado por ${formatCurrency(totalSpent - group.budget)}`
              : `Quedan ${formatCurrency(group.budget - totalSpent)}`}
          </p>
        </div>
      )}

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

      {/* ── 4-TAB BAR ── */}
      <div className="flex rounded-xl bg-muted p-1 gap-1">
        {(
          [
            { key: "gastos",   label: "Gastos",   Icon: Receipt    },
            { key: "balance",  label: "Balance",  Icon: Scale      },
            { key: "miembros", label: "Miembros", Icon: Users      },
            { key: "mas",      label: "Más",      Icon: LayoutGrid },
          ] as const
        ).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => { setTab(key); if (key !== "mas") setExtraTab(null) }}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 rounded-lg py-2 text-[11px] font-medium transition-colors",
              tab === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Gastos tab ── */}
      {tab === "gastos" && (
        <div className="space-y-3">
          {/* Notes efímeras del grupo */}
          <GroupNotes groupId={group.id} members={group.members} />

          {/* ── Feature 10: Monthly summary strip ── */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-xl bg-muted/50 px-3 py-2 text-center">
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(monthlyStats.totalThisMonth)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Total este mes</p>
            </div>
            <div className="flex-1 rounded-xl bg-muted/50 px-3 py-2 text-center">
              <p className="text-sm font-semibold tabular-nums">{monthlyStats.countThisMonth}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Gastos este mes</p>
            </div>
            <div className="flex-1 rounded-xl bg-muted/50 px-3 py-2 text-center">
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(monthlyStats.myShareThisMonth)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Mi parte</p>
            </div>
          </div>

          {/* Search + filter bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input type="search"
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
            <EmptyState
              icon={Receipt}
              title={expenses.length === 0 ? "Sin gastos en el grupo" : "Sin resultados"}
              description={expenses.length === 0 ? "Añade el primero con el botón de arriba" : "Prueba cambiando los filtros"}
              compact
            />
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

            // Privacy filter: hide private expenses from non-creators
            if (e.privacy === "private" && e.paidByUid !== currentUid) return null

            return (
              <div key={e.id} className="rounded-xl border bg-card hover:bg-accent/10 transition-colors group overflow-hidden">
                <div className="flex items-center gap-3 px-3 pt-3 pb-2">
                  {/* Category icon */}
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base"
                    style={{ backgroundColor: `${cat?.color ?? "#6b7280"}18` }}
                  >
                    {cat?.icon ?? "📦"}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-semibold truncate">{e.merchant}</p>
                      {e.privacy === "private" && <span className="text-[10px]" title="Privado">🔒</span>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        {isMyExpense ? "Tú" : e.paidByName}
                      </span>
                      {splitLabel && (
                        <Badge variant="secondary" className="text-[11px] h-4 px-1.5">{splitLabel}</Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground/60">·</span>
                      <span className="text-[11px] text-muted-foreground capitalize">
                        {format(toDate(e.date), "d MMM", { locale: es })}
                      </span>
                    </div>
                  </div>

                  {/* Amount + actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="text-right mr-1">
                      <p className="tabular-nums text-sm font-bold">{formatCurrency(e.total, e.currency)}</p>
                      {e.splitType !== "full" && e.splitWith.length > 1 && (
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {isMyExpense
                            ? `+${formatCurrency(e.total - myShare, e.currency)}`
                            : `tu parte ${formatCurrency(myShare, e.currency)}`}
                        </p>
                      )}
                    </div>

                    {/* Comment button — always visible on card */}
                    <button
                      onClick={() => setCommentExpense(e)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Comentarios"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>

                    {/* ⋮ dropdown: historial + editar + eliminar */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setAuditExpense(e)}>
                          <History className="h-4 w-4" />
                          Historial
                        </DropdownMenuItem>
                        {canEdit && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEdit(e)}>
                              <Pencil className="h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(e)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Reactions row */}
                <div className="px-3 pb-2">
                  <ExpenseReactions groupId={group.id} expenseId={e.id} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Shared dialogs (comments + audit) ── */}
      {commentExpense && (
        <CommentsDialog
          open={!!commentExpense}
          onClose={() => setCommentExpense(null)}
          groupId={group.id}
          expenseId={commentExpense.id}
          expenseName={commentExpense.merchant}
        />
      )}
      {auditExpense && (
        <AuditLogDialog
          open={!!auditExpense}
          onOpenChange={(v) => { if (!v) setAuditExpense(null) }}
          groupId={group.id}
          expenseId={auditExpense.id}
          merchant={auditExpense.merchant}
        />
      )}

      {/* ── Balance tab ── */}
      {tab === "balance" && user && (
        <BalanceTab group={group} expenses={expenses} settlements={settlements} currentUid={currentUid} />
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
                    <p className="text-[11px] text-muted-foreground">
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
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Código de invitación</p>
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
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs"
                onClick={() => {
                  const url = `${window.location.origin}/join/${inviteCode}`
                  const shareData = {
                    title: `Únete al grupo "${group.name}"`,
                    text: `Te invito a unirte al grupo de gastos compartidos "${group.name}" en ReciboTrack.`,
                    url,
                  }
                  if (navigator.share) {
                    navigator.share(shareData).catch(() => {
                      navigator.clipboard.writeText(url)
                      toast.success("Enlace copiado al portapapeles")
                    })
                  } else {
                    navigator.clipboard.writeText(url)
                    toast.success("Enlace de invitación copiado")
                  }
                }}
              >
                <LinkIcon className="h-3.5 w-3.5" />
                Compartir enlace de invitación
              </Button>
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

      {/* ── Más tab ── */}
      {tab === "mas" && (
        <div className="space-y-4">
          {extraTab === null ? (
            /* Feature grid */
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { key: "stats",     Icon: BarChart2,     label: "Análisis",      desc: "Estadísticas y tendencias" },
                  { key: "eventos",   Icon: Calendar,      label: "Eventos",        desc: "Citas y planes del grupo" },
                  { key: "encuestas", Icon: ClipboardList, label: "Encuestas",      desc: "Vota con tu grupo" },
                  { key: "deseos",    Icon: Gift,          label: "Lista de deseos", desc: "Cosas que quieren comprar" },
                  { key: "retos",     Icon: Target,        label: "Retos",          desc: "Apuestas y desafíos" },
                  { key: "carpetas",  Icon: FolderOpen,    label: "Carpetas",       desc: "Organiza los gastos" },
                ] as { key: ExtraTab & string; Icon: React.FC<{ className?: string }>; label: string; desc: string }[]
              ).map(({ key, Icon, label, desc }) => (
                <button
                  key={key}
                  onClick={() => setExtraTab(key as ExtraTab)}
                  className="rounded-2xl border bg-card p-4 flex flex-col items-center gap-2 text-center hover:bg-accent/50 transition-colors"
                >
                  <Icon className="h-6 w-6 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            /* Extra feature view */
            <div className="space-y-4">
              {/* Back to grid */}
              <button
                onClick={() => setExtraTab(null)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Volver
              </button>

              {extraTab === "stats" && (
                <div className="space-y-4">
                  {expenses.length > 0 && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline" size="sm" className="gap-1.5 text-xs flex-1"
                        onClick={() => exportGroupCSV(group, expenses, settlements)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Exportar CSV
                      </Button>
                      <Button
                        variant="outline" size="sm" className="gap-1.5 text-xs flex-1"
                        onClick={() => exportGroupPDF(group, expenses, settlements, computeBalances(expenses, settlements, group.members))}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Exportar PDF
                      </Button>
                    </div>
                  )}
                  <StatsTab
                    expenses={filteredExpenses.length < expenses.length ? filteredExpenses : expenses}
                    group={group}
                    categories={categories}
                  />
                </div>
              )}

              {extraTab === "eventos" && (
                <GroupEvents groupId={group.id} members={group.members} />
              )}

              {extraTab === "encuestas" && (
                <GroupPolls groupId={group.id} members={group.members} />
              )}

              {extraTab === "deseos" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border bg-card p-4">
                    <GroupWishlist groupId={group.id} currency="USD" />
                  </div>
                  <GroupChecklists groupId={group.id} />
                </div>
              )}

              {extraTab === "retos" && (
                <GroupBets groupId={group.id} members={group.members} />
              )}

              {extraTab === "carpetas" && (
                <GroupFolders groupId={group.id} />
              )}
            </div>
          )}
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

      {/* ── Confirm dialogs ── */}
      <ConfirmDialog
        open={!!deleteExpenseTarget}
        onOpenChange={(o) => { if (!o) setDeleteExpenseTarget(null) }}
        title={`¿Eliminar "${deleteExpenseTarget?.merchant}"?`}
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={confirmDeleteExpense}
      />
      <ConfirmDialog
        open={leaveConfirm}
        onOpenChange={setLeaveConfirm}
        title={`¿Salir del grupo "${group.name}"?`}
        description="Perderás el acceso a los gastos y el historial del grupo."
        confirmLabel="Salir"
        onConfirm={confirmLeave}
      />
      <ConfirmDialog
        open={archiveConfirm}
        onOpenChange={setArchiveConfirm}
        title={`¿Archivar "${group.name}"?`}
        description="El grupo seguirá visible en la sección de archivados."
        confirmLabel="Archivar"
        onConfirm={confirmArchive}
      />

      {/* ── Edit group dialog ── */}
      <Dialog open={editGroupOpen} onOpenChange={setEditGroupOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input
                placeholder="Viaje de verano, gastos del apartamento..."
                value={editGroupDesc}
                onChange={(e) => setEditGroupDesc(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Presupuesto total <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <div className="relative">
                <Target className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="number" inputMode="decimal" step="0.01" min="0"
                  placeholder="0.00 — sin límite"
                  className="pl-8 tabular-nums"
                  value={editGroupBudget}
                  onChange={(e) => setEditGroupBudget(e.target.value)}
                />
              </div>
              {editGroupBudget && parseFloat(editGroupBudget) > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Límite: {formatCurrency(parseFloat(editGroupBudget))} · Gastado: {formatCurrency(totalSpent)}
                  {totalSpent > parseFloat(editGroupBudget) && <span className="text-destructive font-medium"> (superado)</span>}
                </p>
              )}
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
  const { user } = useAuth()
  const { data: groups = [], isLoading } = useMyGroups()
  const createGroup = useCreateGroup()
  const joinGroup = useJoinGroup()
  const unarchiveGroup = useUnarchiveGroup()

  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [groupDesc, setGroupDesc] = useState("")
  const [groupEmoji, setGroupEmoji] = useState("👨‍👩‍👧‍👦")
  const [groupType, setGroupType] = useState<GroupType>("otro")
  const [joinCode, setJoinCode] = useState("")
  const [newGroupCode, setNewGroupCode] = useState<string | null>(null)
  const [copiedNewCode, setCopiedNewCode] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const activeGroups   = groups.filter((g) => !(g as Group & { archived?: boolean }).archived)
  const archivedGroups = groups.filter((g) => !!(g as Group & { archived?: boolean }).archived)

  async function handleCreate() {
    if (!groupName.trim()) { toast.error("Ponle un nombre al grupo"); return }
    try {
      const { inviteCode } = await createGroup.mutateAsync({
        name: groupName,
        emoji: groupEmoji,
        description: groupDesc.trim() || undefined,
        type: groupType,
      })
      setNewGroupCode(inviteCode)
      toast.success("Grupo creado")
      setGroupName("")
      setGroupDesc("")
      setGroupType("otro")
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
      {/* ── List header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl">Grupos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{activeGroups.length} activo{activeGroups.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="icon" className="h-8 w-8" title="Unirse a un grupo" onClick={() => setJoinOpen(true)}>
            <UserPlus className="h-4 w-4" />
          </Button>
          <Button size="icon" className="h-8 w-8" title="Crear grupo" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>


      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : activeGroups.length === 0 && archivedGroups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin grupos todavía"
          description="Crea un grupo con familia o amigos para controlar gastos compartidos"
          actions={[
            { label: "Crear grupo", onClick: () => setCreateOpen(true), icon: <Plus className="h-4 w-4" /> },
            { label: "Unirme con código", onClick: () => setJoinOpen(true), icon: <UserPlus className="h-4 w-4" />, variant: "outline" },
          ]}
        />
      ) : (
        <div className="space-y-3">
          {activeGroups.map((group, idx) => (
            <button key={group.id} onClick={() => setSelectedGroup(group)}
              style={{ "--i": idx } as React.CSSProperties}
              className="stagger-item group w-full text-left rounded-xl border p-4 hover:bg-accent/30 hover:border-border/80 hover:shadow-sm transition-all duration-200">
              <div className="flex items-center gap-3">
                <span className="text-3xl transition-transform duration-200 group-hover:scale-110">{group.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{group.name}</p>
                    <GroupTypeBadge type={group.type} />
                  </div>
                  {group.description && (
                    <p className="text-[11px] text-muted-foreground truncate italic">{group.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {group.members.length} miembros · {group.members.map((m) => m.displayName.split(" ")[0]).join(", ")}
                  </p>
                  {user && (
                    <GroupBalanceBadge
                      groupId={group.id}
                      members={group.members}
                      currentUid={user.uid}
                    />
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0 transition-all duration-200 group-hover:text-muted-foreground group-hover:translate-x-0.5" />
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
                <div key={group.id} className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-muted/20 mb-2">
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
                <Label>Descripción <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input placeholder="Para qué es este grupo..." value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de grupo</Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {GROUP_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setGroupType(t.value)}
                      className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-xs font-medium transition-colors ${
                        groupType === t.value ? "border-foreground bg-accent" : "border-border text-muted-foreground hover:border-muted-foreground"
                      }`}
                    >
                      <span className="text-lg">{t.emoji}</span>
                      <span className="text-[11px]">{t.label}</span>
                    </button>
                  ))}
                </div>
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
