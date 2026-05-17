"use client"

import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Plus, Check, CalendarDays } from "lucide-react"
import { useGroupEvents, useAddGroupEvent, useRsvpEvent, useSettleEvent, type GroupEvent } from "@/hooks/use-group-events"
import { useAuth } from "@/hooks/use-auth"
import { formatCurrency, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CURRENCIES } from "@/lib/constants"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import type { GroupMember } from "@/hooks/use-groups"

interface Props {
  groupId: string
  members: GroupMember[]
}

export function GroupEvents({ groupId, members }: Props) {
  const { user } = useAuth()
  const { data: events, isLoading } = useGroupEvents(groupId)
  const addEvent   = useAddGroupEvent()
  const rsvp       = useRsvpEvent()
  const settle     = useSettleEvent()
  const [createOpen, setCreateOpen] = useState(false)

  // Create form state
  const [title, setTitle]           = useState("")
  const [date, setDate]             = useState(new Date().toISOString().split("T")[0])
  const [totalCost, setTotalCost]   = useState("")
  const [currency, setCurrency]     = useState("USD")
  const [splitMethod, setSplitMethod] = useState<"equal" | "proportional">("equal")

  const memberMap = new Map(members.map((m) => [m.uid, m.displayName]))

  async function handleCreate() {
    if (!title.trim() || !totalCost) { toast.error("Completa título y costo"); return }
    try {
      await addEvent.mutateAsync({
        groupId, title, date: new Date(date + "T12:00:00"),
        totalCost: parseFloat(totalCost), currency, splitMethod,
      })
      toast.success("Evento creado")
      setCreateOpen(false)
      setTitle(""); setTotalCost("")
    } catch { toast.error("Error al crear evento") }
  }

  async function handleRsvp(event: GroupEvent, attending: boolean) {
    try {
      await rsvp.mutateAsync({ groupId, eventId: event.id, attending })
    } catch { toast.error("Error al actualizar RSVP") }
  }

  async function handleSettle(event: GroupEvent) {
    if (event.attendees.length < 2) { toast.error("Se necesitan al menos 2 asistentes"); return }
    if (!confirm(`¿Liquidar "${event.title}"? Se crearán gastos por ${formatCurrency(event.totalCost / event.attendees.length, event.currency)} por persona.`)) return
    try {
      await settle.mutateAsync({ groupId, event, memberMap })
      toast.success("Evento liquidado")
    } catch { toast.error("Error al liquidar") }
  }

  if (isLoading) return <Skeleton className="h-24 rounded-xl" />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Eventos</p>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3 w-3" />
          Crear evento
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin eventos todavía</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const isAttending = user ? event.attendees.includes(user.uid) : false
            const shareAmt = event.attendees.length > 0 ? event.totalCost / event.attendees.length : event.totalCost
            return (
              <div key={event.id} className={cn(
                "rounded-xl border p-3 space-y-2",
                event.settled ? "opacity-60 bg-muted/30" : "bg-card"
              )}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{event.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(event.date.toDate(), "d 'de' MMMM yyyy", { locale: es })}
                      {event.settled && " · ✅ Liquidado"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums">{formatCurrency(event.totalCost, event.currency)}</p>
                    <p className="text-[10px] text-muted-foreground">{event.attendees.length} asistentes</p>
                  </div>
                </div>

                {/* Attendee avatars */}
                <div className="flex items-center gap-1 flex-wrap">
                  {event.attendees.map((uid) => (
                    <div key={uid} className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold" title={memberMap.get(uid) ?? uid}>
                      {(memberMap.get(uid) ?? uid)[0]?.toUpperCase()}
                    </div>
                  ))}
                  {event.attendees.length > 0 && (
                    <span className="text-[10px] text-muted-foreground ml-1">
                      {formatCurrency(shareAmt, event.currency)}/persona
                    </span>
                  )}
                </div>

                {!event.settled && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleRsvp(event, !isAttending)}
                      className={cn(
                        "flex-1 rounded-lg border py-1.5 text-[11px] font-medium transition-colors",
                        isAttending
                          ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
                          : "border-border text-muted-foreground hover:border-foreground"
                      )}
                    >
                      {isAttending ? "✓ Voy" : "Apuntarme"}
                    </button>
                    {event.attendees.length >= 2 && (
                      <button
                        onClick={() => handleSettle(event)}
                        className="flex-1 rounded-lg border border-primary/30 bg-primary/8 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/12 transition-colors"
                      >
                        Liquidar
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create event dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Crear evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input placeholder="Cena de cumpleaños..." value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fecha</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Costo total *</Label>
                <Input type="number" step="0.01" placeholder="0.00" className="tabular-nums" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>División</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["equal", "proportional"] as const).map((m) => (
                  <button key={m} onClick={() => setSplitMethod(m)}
                    className={cn(
                      "rounded-lg border p-2 text-xs text-center transition-colors",
                      splitMethod === m ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground"
                    )}
                  >
                    {m === "equal" ? "÷ Iguales" : "⚖️ Proporcional"}
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={addEvent.isPending}>
              <Check className="h-4 w-4 mr-1.5" />
              Crear evento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
