"use client"

import { useState } from "react"
import { format, differenceInDays } from "date-fns"
import { es } from "date-fns/locale"
import { Plus, Trophy, Target, Clock, Users } from "lucide-react"
import {
  useGroupBets,
  useCreateBet,
  useJoinBet,
  type GroupBet,
} from "@/hooks/use-group-bets"
import { useAuth } from "@/hooks/use-auth"
import { formatCurrency, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import type { GroupMember } from "@/hooks/use-groups"
import { CURRENCIES, DEFAULT_CATEGORIES } from "@/lib/constants"
import { useCategories } from "@/hooks/use-categories"

interface Props {
  groupId: string
  members: GroupMember[]
}

function daysLeft(endsAt: { toDate(): Date }): number {
  return Math.max(0, differenceInDays(endsAt.toDate(), new Date()))
}

function BetCard({ bet, members, onJoin }: {
  bet: GroupBet
  members: GroupMember[]
  onJoin: (betId: string) => void
}) {
  const { user } = useAuth()
  const uid = user?.uid ?? ""
  const isParticipant = bet.participants.includes(uid)
  const creator = members.find((m) => m.uid === bet.creatorId)
  const remaining = daysLeft(bet.endsAt)

  const statusColor =
    bet.status === "resolved" ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20" :
    bet.status === "active"   ? "bg-primary/10 text-primary border-primary/20" :
                                "bg-muted text-muted-foreground border-border"

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold leading-tight">{bet.title}</p>
            <Badge
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0 shrink-0", statusColor)}
            >
              {bet.status === "resolved" ? "Resuelto" : bet.status === "active" ? "Activo" : "Abierto"}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Creado por {creator?.displayName ?? bet.creatorId}
          </p>
        </div>
        {bet.status === "resolved" && bet.result && (
          <span className="text-2xl shrink-0">🏆</span>
        )}
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-muted-foreground text-[10px]">Meta</p>
          <p className="font-semibold tabular-nums">{formatCurrency(bet.targetAmount, bet.currency)}</p>
          <p className="text-muted-foreground text-[10px]">{bet.period === "week" ? "esta semana" : "este mes"}</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-muted-foreground text-[10px]">Apuesta</p>
          <p className="font-medium text-[11px] leading-snug">{bet.stake}</p>
        </div>
      </div>

      {/* Participants */}
      <div className="flex items-center gap-2">
        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">
          {bet.participants.length} participante{bet.participants.length !== 1 ? "s" : ""}
          {bet.participants.includes(uid) && " · Participas"}
        </p>
        {bet.category && (
          <Badge variant="secondary" className="ml-auto text-[10px] px-1.5">
            {bet.category}
          </Badge>
        )}
      </div>

      {/* Time remaining or ends at */}
      {bet.status !== "resolved" && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {remaining === 0
            ? "Vence hoy"
            : `${remaining} día${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""}`}
          <span className="text-muted-foreground/50">·</span>
          {format(bet.endsAt.toDate(), "d MMM yyyy", { locale: es })}
        </div>
      )}

      {/* Winner (resolved) */}
      {bet.status === "resolved" && bet.result && (
        <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-3 py-2">
          <p className="text-xs font-semibold text-green-700 dark:text-green-400">
            🏆 Ganador: {bet.result.winnerName}
          </p>
          <p className="text-[10px] text-green-600/70 dark:text-green-500/70">
            Gastó {formatCurrency(bet.result.actualAmount, bet.currency)}
          </p>
        </div>
      )}

      {/* Join button */}
      {bet.status !== "resolved" && !isParticipant && uid !== bet.creatorId && (
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs h-8"
          onClick={() => onJoin(bet.id)}
        >
          Unirse al reto
        </Button>
      )}
    </div>
  )
}

export function GroupBets({ groupId, members }: Props) {
  const { user } = useAuth()
  const { bets, isLoading } = useGroupBets(groupId)
  const createBet = useCreateBet(groupId)
  const joinBet   = useJoinBet(groupId)
  const { data: categories = [] } = useCategories()
  const [createOpen, setCreateOpen] = useState(false)

  const allCategories = categories.length > 0 ? categories : DEFAULT_CATEGORIES

  // Form state
  const [title, setTitle]           = useState("")
  const [category, setCategory]     = useState("")
  const [amount, setAmount]         = useState("")
  const [currency, setCurrency]     = useState("USD")
  const [period, setPeriod]         = useState<"week" | "month">("month")
  const [stake, setStake]           = useState("")
  const [saving, setSaving]         = useState(false)

  function resetForm() {
    setTitle(""); setCategory(""); setAmount(""); setCurrency("USD")
    setPeriod("month"); setStake("")
  }

  async function handleCreate() {
    if (!title.trim()) { toast.error("El título es obligatorio"); return }
    const target = parseFloat(amount)
    if (!target || target <= 0) { toast.error("El monto objetivo debe ser mayor que 0"); return }
    if (!stake.trim()) { toast.error("La apuesta es obligatoria"); return }

    setSaving(true)
    try {
      await createBet.mutateAsync({
        title: title.trim(),
        category: category || undefined,
        targetAmount: target,
        currency,
        period,
        stake: stake.trim(),
      })
      toast.success("Reto creado")
      resetForm()
      setCreateOpen(false)
    } catch {
      toast.error("Error al crear el reto")
    } finally {
      setSaving(false)
    }
  }

  async function handleJoin(betId: string) {
    try {
      await joinBet.mutateAsync(betId)
      toast.success("Te has unido al reto")
    } catch {
      toast.error("Error al unirse")
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
      </div>
    )
  }

  const open     = bets.filter((b) => b.status === "open")
  const active   = bets.filter((b) => b.status === "active")
  const resolved = bets.filter((b) => b.status === "resolved")

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Retos del grupo</p>
          {bets.length > 0 && (
            <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              {bets.length}
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Crear reto
        </Button>
      </div>

      {/* Empty state */}
      {bets.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-card/50 p-8 text-center space-y-2">
          <p className="text-2xl">🎯</p>
          <p className="text-sm font-semibold">Sin retos activos</p>
          <p className="text-xs text-muted-foreground">Crea un reto para ver quién gasta menos este mes</p>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Crear primer reto
          </Button>
        </div>
      )}

      {/* Active bets */}
      {active.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Activos</p>
          {active.map((bet) => (
            <BetCard key={bet.id} bet={bet} members={members} onJoin={handleJoin} />
          ))}
        </div>
      )}

      {/* Open bets */}
      {open.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Abiertos</p>
          {open.map((bet) => (
            <BetCard key={bet.id} bet={bet} members={members} onJoin={handleJoin} />
          ))}
        </div>
      )}

      {/* Resolved bets */}
      {resolved.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            Resueltos
          </p>
          {resolved.map((bet) => (
            <BetCard key={bet.id} bet={bet} members={members} onJoin={handleJoin} />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm() }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-4 w-4" /> Nuevo reto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Título del reto *</Label>
              <Input
                placeholder="Me mantengo bajo $500 en restaurantes este mes"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monto objetivo *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="500.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Período</Label>
                <Select value={period} onValueChange={(v) => setPeriod(v as "week" | "month")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Esta semana</SelectItem>
                    <SelectItem value="month">Este mes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Categoría <span className="text-muted-foreground">(opcional)</span></Label>
                <Select value={category || "__none__"} onValueChange={(v) => setCategory(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Todas las categorías</SelectItem>
                    {allCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Apuesta amistosa *</Label>
              <Input
                placeholder="El perdedor paga los cafés"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">¿Qué gana el que más se controla?</p>
            </div>

            <Button className="w-full" onClick={handleCreate} disabled={saving}>
              Crear reto
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
