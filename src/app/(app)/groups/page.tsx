"use client"

import { useState, useMemo } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useCategories } from "@/hooks/use-categories"
import {
  useMyGroups, useGroupExpenses, useCreateGroup, useJoinGroup,
  useLeaveGroup, useAddGroupExpense, useDeleteGroupExpense, useRefreshInviteCode,
  type Group, type GroupExpense,
} from "@/hooks/use-groups"
import { formatCurrency, toDate } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { PAYMENT_METHODS, CURRENCIES } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  Users, Plus, LogOut, Copy, RefreshCw, Trash2,
  ArrowLeft, Receipt, UserPlus, Crown, Check,
} from "lucide-react"

// ─── Emoji picker (simple) ─────────────────────────────────────────────────────
const GROUP_EMOJIS = ["👨‍👩‍👧‍👦", "👫", "🏠", "💼", "🎓", "✈️", "🎉", "💰", "🍽️", "🛒", "🚗", "🏋️"]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function BalanceSummary({ expenses, currentUid, members }: {
  expenses: GroupExpense[]
  currentUid: string
  members: Group["members"]
}) {
  const balances = useMemo(() => {
    const map: Record<string, number> = {}
    members.forEach((m) => { map[m.uid] = 0 })

    expenses.forEach((e) => {
      if (e.splitType === "equal") {
        const splitUids = e.splitWith.length > 0 ? e.splitWith : [e.paidByUid]
        const share = e.total / splitUids.length
        splitUids.forEach((uid) => {
          if (uid !== e.paidByUid) {
            map[e.paidByUid] = (map[e.paidByUid] ?? 0) + share
            map[uid] = (map[uid] ?? 0) - share
          }
        })
      } else if (e.splitType === "custom" && e.customShares) {
        // Each non-payer owes their designated share to the payer
        Object.entries(e.customShares).forEach(([uid, amount]) => {
          if (uid !== e.paidByUid && amount > 0) {
            map[e.paidByUid] = (map[e.paidByUid] ?? 0) + amount
            map[uid] = (map[uid] ?? 0) - amount
          }
        })
      }
      // "full" = no split, no balance changes
    })

    return members.map((m) => ({ ...m, balance: map[m.uid] ?? 0 }))
  }, [expenses, members])

  const myBalance = balances.find((b) => b.uid === currentUid)?.balance ?? 0

  return (
    <div className="space-y-2">
      <div className={`rounded-lg px-4 py-3 text-center ${myBalance >= 0 ? "bg-green-500/10" : "bg-destructive/10"}`}>
        <p className="text-xs text-muted-foreground">Tu balance</p>
        <p className={`text-xl font-bold tabular-nums ${myBalance >= 0 ? "text-green-600" : "text-destructive"}`}>
          {myBalance >= 0 ? "+" : ""}{formatCurrency(myBalance)}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {myBalance > 0 ? "te deben" : myBalance < 0 ? "debes" : "estás en cero"}
        </p>
      </div>
      <div className="space-y-1">
        {balances.filter((b) => b.uid !== currentUid).map((b) => (
          <div key={b.uid} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground text-xs">{b.displayName}</span>
            <span className={`tabular-nums text-xs font-medium ${b.balance > 0 ? "text-destructive" : b.balance < 0 ? "text-green-600" : "text-muted-foreground"}`}>
              {b.balance > 0 ? `te debe ${formatCurrency(b.balance)}` : b.balance < 0 ? `le debes ${formatCurrency(Math.abs(b.balance))}` : "en cero"}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Group detail view ─────────────────────────────────────────────────────────

function GroupDetail({ group, onBack }: { group: Group; onBack: () => void }) {
  const { user } = useAuth()
  const { data: categories = [] } = useCategories()
  const { data: expenses = [], isLoading } = useGroupExpenses(group.id)
  const addExpense = useAddGroupExpense()
  const deleteExpense = useDeleteGroupExpense()
  const leaveGroup = useLeaveGroup()
  const refreshCode = useRefreshInviteCode()

  const [addOpen, setAddOpen] = useState(false)
  const [tab, setTab] = useState<"gastos" | "balance" | "miembros">("gastos")
  const [copiedCode, setCopiedCode] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    merchant: "", date: new Date().toISOString().split("T")[0],
    total: "", subtotal: "", tax: "0", category: "otros",
    paymentMethod: "", currency: "USD", notes: "",
    splitType: "equal" as "equal" | "full" | "custom",
    splitWith: group.members.map((m) => m.uid),
    customShares: Object.fromEntries(group.members.map((m) => [m.uid, ""])) as Record<string, string>,
  })

  const inviteCode = group.inviteCodes?.[0] ?? "—"
  const isAdmin = group.adminUid === user?.uid
  const totalSpent = expenses.reduce((a, e) => a + e.total, 0)

  function copyCode() {
    navigator.clipboard.writeText(inviteCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
    toast.success("Código copiado")
  }

  async function handleAddExpense() {
    if (!expenseForm.merchant || !expenseForm.total) {
      toast.error("Completa comercio y monto"); return
    }
    const totalAmt = parseFloat(expenseForm.total) || 0

    // Validate custom shares
    if (expenseForm.splitType === "custom") {
      const sharesSum = expenseForm.splitWith.reduce(
        (acc, uid) => acc + (parseFloat(expenseForm.customShares[uid] ?? "0") || 0), 0
      )
      if (Math.abs(sharesSum - totalAmt) > 0.01) {
        toast.error(`La suma de partes (${sharesSum.toFixed(2)}) no coincide con el total (${totalAmt.toFixed(2)})`); return
      }
    }

    const customSharesPayload = expenseForm.splitType === "custom"
      ? Object.fromEntries(
          expenseForm.splitWith.map((uid) => [uid, parseFloat(expenseForm.customShares[uid] ?? "0") || 0])
        )
      : undefined

    try {
      await addExpense.mutateAsync({
        groupId: group.id,
        input: {
          merchant: expenseForm.merchant,
          date: new Date(expenseForm.date + "T12:00:00"),
          items: [],
          subtotal: parseFloat(expenseForm.subtotal) || totalAmt,
          tax: parseFloat(expenseForm.tax) || 0,
          total: totalAmt,
          paymentMethod: expenseForm.paymentMethod || null,
          reference: null,
          category: expenseForm.category,
          currency: expenseForm.currency,
          notes: expenseForm.notes,
          tags: [],
          receiptImageUrl: null,
        },
        splitWith: expenseForm.splitWith,
        splitType: expenseForm.splitType,
        customShares: customSharesPayload,
      })
      toast.success("Gasto añadido al grupo")
      setAddOpen(false)
    } catch {
      toast.error("Error al añadir gasto")
    }
  }

  // Distribute total equally among selected members (helper for custom mode)
  function distributeEqually() {
    const total = parseFloat(expenseForm.total) || 0
    const count = expenseForm.splitWith.length
    if (count === 0) return
    const share = (total / count).toFixed(2)
    setExpenseForm((f) => ({
      ...f,
      customShares: Object.fromEntries(f.splitWith.map((uid) => [uid, share])),
    }))
  }

  async function handleDelete(e: GroupExpense) {
    if (!confirm("¿Eliminar este gasto del grupo?")) return
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al salir")
    }
  }

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
          <p className="text-xs text-muted-foreground">{group.members.length} miembros · {formatCurrency(totalSpent)} en total</p>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Gasto
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(["gastos", "balance", "miembros"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition-colors ${tab === t ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Gastos tab */}
      {tab === "gastos" && (
        <div className="space-y-2">
          {isLoading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)
          ) : expenses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin gastos en el grupo</p>
              <p className="text-xs mt-1">Añade el primero con el botón de arriba</p>
            </div>
          ) : expenses.map((e) => {
            const cat = categories.find((c) => c.id === e.category)
            const isMyExpense = e.paidByUid === user?.uid
            const myUid = user?.uid ?? ""
            const myShare = e.splitType === "equal" && e.splitWith.length > 0
              ? e.total / e.splitWith.length
              : e.splitType === "custom" && e.customShares
              ? (e.customShares[myUid] ?? 0)
              : e.total
            const splitLabel = e.splitType === "equal"
              ? `÷${e.splitWith.length}`
              : e.splitType === "custom"
              ? "⚖️"
              : null
            return (
              <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-accent/20 transition-colors group">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
                  style={{ backgroundColor: `${cat?.color ?? "#6b7280"}20` }}>
                  {cat?.icon ?? "📦"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.merchant}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground">
                      {isMyExpense ? "Tú pagaste" : `Pagó ${e.paidByName}`}
                    </p>
                    {splitLabel && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {splitLabel}
                      </Badge>
                    )}
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
                {isMyExpense && (
                  <button onClick={() => handleDelete(e)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all ml-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Balance tab */}
      {tab === "balance" && user && (
        <BalanceSummary expenses={expenses} currentUid={user.uid} members={group.members} />
      )}

      {/* Miembros tab */}
      {tab === "miembros" && (
        <div className="space-y-4">
          <div className="space-y-2">
            {group.members.map((m) => (
              <div key={m.uid} className="flex items-center gap-3 p-3 rounded-xl border">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                  {m.displayName[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.displayName}
                    {m.uid === user?.uid && <span className="text-muted-foreground font-normal"> (tú)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
                {m.role === "admin" && <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
              </div>
            ))}
          </div>

          {/* Invite code */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground mb-2">Código de invitación</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-lg font-bold tracking-widest text-center py-2 bg-muted rounded-lg">
                  {inviteCode}
                </code>
                <Button size="icon" variant="outline" onClick={copyCode}>
                  {copiedCode ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
                {isAdmin && (
                  <Button size="icon" variant="outline" onClick={async () => {
                    const code = await refreshCode.mutateAsync(group.id)
                    toast.success(`Nuevo código: ${code}`)
                  }}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Comparte este código para que otros se unan al grupo
              </p>
            </CardContent>
          </Card>

          <Button variant="outline" className="w-full gap-2 text-destructive hover:text-destructive border-destructive/30"
            onClick={handleLeave} disabled={leaveGroup.isPending}>
            <LogOut className="h-4 w-4" />
            Salir del grupo
          </Button>
        </div>
      )}

      {/* Add expense dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Añadir gasto al grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Comercio</Label>
                <Input value={expenseForm.merchant}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, merchant: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha</Label>
                <Input type="date" value={expenseForm.date}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Total</Label>
                <Input type="number" step="0.01" value={expenseForm.total} className="tabular-nums"
                  onChange={(e) => setExpenseForm((f) => ({ ...f, total: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={expenseForm.category}
                  onValueChange={(v) => setExpenseForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <Select value={expenseForm.currency}
                  onValueChange={(v) => setExpenseForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Split type */}
            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-xs font-medium">División del gasto</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(["equal", "custom", "full"] as const).map((type) => (
                  <button key={type} onClick={() => setExpenseForm((f) => ({ ...f, splitType: type }))}
                    className={`rounded-lg border p-2 text-[11px] text-center transition-colors leading-tight ${expenseForm.splitType === type ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground"}`}>
                    {type === "equal" ? "÷ Iguales" : type === "custom" ? "⚖️ Personalizado" : "👤 Solo yo"}
                  </button>
                ))}
              </div>

              {(expenseForm.splitType === "equal" || expenseForm.splitType === "custom") && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">¿Quiénes participan?</p>
                  {group.members.map((m) => {
                    const checked = expenseForm.splitWith.includes(m.uid)
                    return (
                      <div key={m.uid} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setExpenseForm((f) => ({
                              ...f,
                              splitWith: e.target.checked
                                ? [...f.splitWith, m.uid]
                                : f.splitWith.filter((u) => u !== m.uid),
                            }))
                          }}
                          className="shrink-0"
                        />
                        <span className="text-xs flex-1 truncate">
                          {m.displayName}{m.uid === user?.uid ? " (tú)" : ""}
                        </span>
                        {expenseForm.splitType === "custom" && checked && (
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={expenseForm.customShares[m.uid] ?? ""}
                            onChange={(e) => setExpenseForm((f) => ({
                              ...f,
                              customShares: { ...f.customShares, [m.uid]: e.target.value },
                            }))}
                            className="w-24 h-7 text-xs tabular-nums text-right"
                            placeholder="0.00"
                          />
                        )}
                      </div>
                    )
                  })}

                  {/* Equal split preview */}
                  {expenseForm.splitType === "equal" && expenseForm.splitWith.length > 0 && expenseForm.total && (
                    <p className="text-[11px] text-muted-foreground pt-1 border-t">
                      Parte por persona: <span className="font-medium tabular-nums">
                        {formatCurrency(parseFloat(expenseForm.total) / expenseForm.splitWith.length, expenseForm.currency)}
                      </span>
                    </p>
                  )}

                  {/* Custom split summary */}
                  {expenseForm.splitType === "custom" && expenseForm.splitWith.length > 0 && (
                    <div className="pt-1 border-t space-y-1">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={distributeEqually}
                          className="text-[11px] text-primary hover:underline"
                        >
                          Distribuir igualmente
                        </button>
                        {(() => {
                          const total = parseFloat(expenseForm.total) || 0
                          const sum = expenseForm.splitWith.reduce(
                            (acc, uid) => acc + (parseFloat(expenseForm.customShares[uid] ?? "0") || 0), 0
                          )
                          const diff = total - sum
                          const ok = Math.abs(diff) < 0.01
                          return (
                            <span className={`text-[11px] tabular-nums font-medium ${ok ? "text-green-600" : "text-destructive"}`}>
                              {ok ? "✓ Correcto" : diff > 0 ? `Faltan ${formatCurrency(diff, expenseForm.currency)}` : `Excede ${formatCurrency(Math.abs(diff), expenseForm.currency)}`}
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button className="w-full" onClick={handleAddExpense} disabled={addExpense.isPending}>
              Añadir gasto
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

  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [groupEmoji, setGroupEmoji] = useState("👨‍👩‍👧‍👦")
  const [joinCode, setJoinCode] = useState("")
  const [newGroupCode, setNewGroupCode] = useState<string | null>(null)
  const [copiedNewCode, setCopiedNewCode] = useState(false)

  async function handleCreate() {
    if (!groupName.trim()) { toast.error("Ponle un nombre al grupo"); return }
    try {
      const { groupId, inviteCode } = await createGroup.mutateAsync({ name: groupName, emoji: groupEmoji })
      setNewGroupCode(inviteCode)
      toast.success("Grupo creado")
      setGroupName("")
    } catch {
      toast.error("Error al crear grupo")
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) { toast.error("Ingresa un código de invitación"); return }
    try {
      const { groupName: name } = await joinGroup.mutateAsync(joinCode)
      toast.success(`Te uniste a "${name}"`)
      setJoinOpen(false)
      setJoinCode("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al unirse")
    }
  }

  if (selectedGroup) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <GroupDetail
          group={selectedGroup}
          onBack={() => setSelectedGroup(null)}
        />
      </div>
    )
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl">Grupos</h1>
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
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center text-3xl">👨‍👩‍👧‍👦</div>
          <div>
            <p className="font-semibold">Sin grupos todavía</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Crea un grupo con tu familia o amigos para controlar gastos compartidos y saber quién debe qué
            </p>
          </div>
          <div className="flex gap-3">
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
          {groups.map((group) => (
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
                <p className="text-sm font-medium">¡Grupo creado!</p>
                <p className="text-xs text-muted-foreground">Comparte este código para invitar a otros</p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-2xl font-bold tracking-widest text-center py-3 bg-muted rounded-lg">
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
                <Label>Nombre del grupo</Label>
                <Input placeholder="Familia, Viaje NY, Casa..." value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
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
              />
              <p className="text-[11px] text-muted-foreground">Pídele el código al administrador del grupo</p>
            </div>
            <Button className="w-full" onClick={handleJoin} disabled={joinGroup.isPending || joinCode.length < 5}>
              Unirme
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
