"use client"

import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Plus, BarChart2 } from "lucide-react"
import {
  useGroupPolls, useCreatePoll, useVotePoll, useClosePoll,
  type GroupPoll,
} from "@/hooks/use-group-polls"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import type { GroupMember } from "@/hooks/use-groups"

interface Props {
  groupId: string
  members: GroupMember[]
}

export function GroupPolls({ groupId, members }: Props) {
  const { user } = useAuth()
  const { data: polls, isLoading } = useGroupPolls(groupId)
  const createPoll = useCreatePoll()
  const votePoll   = useVotePoll()
  const closePoll  = useClosePoll()
  const [createOpen, setCreateOpen] = useState(false)

  // Create form state
  const [question, setQuestion] = useState("")
  const [options, setOptions]   = useState(["", ""])
  const [closesAt, setClosesAt] = useState("")
  const [isSplitPoll, setIsSplitPoll] = useState(false)

  function updateOption(i: number, val: string) {
    setOptions((prev) => prev.map((o, j) => (j === i ? val : o)))
  }

  function addOption() {
    if (options.length < 4) setOptions((prev) => [...prev, ""])
  }

  function removeOption(i: number) {
    if (options.length <= 2) return
    setOptions((prev) => prev.filter((_, j) => j !== i))
  }

  async function handleCreate() {
    const validOptions = isSplitPoll
      ? ["Iguales", "Proporcional"]
      : options.filter((o) => o.trim())
    if (!question.trim() || validOptions.length < 2) {
      toast.error("Completa la pregunta y al menos 2 opciones")
      return
    }
    try {
      await createPoll.mutateAsync({
        groupId,
        question: isSplitPoll ? "¿Cómo dividimos el próximo gasto?" : question,
        options: validOptions,
        closesAt: closesAt ? new Date(closesAt + "T23:59:59") : undefined,
      })
      toast.success("Encuesta creada")
      setCreateOpen(false)
      setQuestion(""); setOptions(["", ""]); setClosesAt(""); setIsSplitPoll(false)
    } catch { toast.error("Error al crear encuesta") }
  }

  async function handleVote(poll: GroupPoll, optionId: string) {
    try {
      await votePoll.mutateAsync({ groupId, pollId: poll.id, optionId, currentOptions: poll.options })
    } catch { toast.error("Error al votar") }
  }

  async function handleClose(poll: GroupPoll) {
    try {
      await closePoll.mutateAsync({ groupId, pollId: poll.id, options: poll.options })
      toast.success("Encuesta cerrada")
    } catch { toast.error("Error al cerrar") }
  }

  if (isLoading) return <Skeleton className="h-24 rounded-xl" />

  const open   = polls.filter((p) => p.status === "open")
  const closed = polls.filter((p) => p.status === "closed")

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Encuestas</p>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3 w-3" />
          Crear encuesta
        </Button>
      </div>

      {polls.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          <BarChart2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin encuestas todavía</p>
        </div>
      ) : (
        <div className="space-y-3">
          {open.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              currentUid={user?.uid ?? ""}
              onVote={(optId) => handleVote(poll, optId)}
              onClose={() => handleClose(poll)}
            />
          ))}
          {closed.length > 0 && (
            <>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground pt-1">Cerradas</p>
              {closed.map((poll) => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  currentUid={user?.uid ?? ""}
                  onVote={() => {}}
                  onClose={() => {}}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Create poll dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva encuesta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Split poll template */}
            <button
              onClick={() => setIsSplitPoll((v) => !v)}
              className={cn(
                "w-full rounded-xl border p-3 text-sm text-left transition-colors",
                isSplitPoll ? "border-primary/40 bg-primary/5" : "border-border hover:border-muted-foreground"
              )}
            >
              <p className="font-medium">⚖️ Encuesta de división</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pregunta rápida sobre cómo dividir: Iguales vs Proporcional</p>
            </button>

            {!isSplitPoll && (
              <>
                <div className="space-y-1.5">
                  <Label>Pregunta *</Label>
                  <Input placeholder="¿Qué restaurante?" value={question} onChange={(e) => setQuestion(e.target.value)} autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label>Opciones</Label>
                  {options.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        placeholder={`Opción ${i + 1}`}
                        value={opt}
                        onChange={(e) => updateOption(i, e.target.value)}
                      />
                      {options.length > 2 && (
                        <button onClick={() => removeOption(i)} className="text-muted-foreground hover:text-destructive shrink-0">✕</button>
                      )}
                    </div>
                  ))}
                  {options.length < 4 && (
                    <button onClick={addOption} className="text-xs text-primary hover:underline">+ Añadir opción</button>
                  )}
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label>Cierre automático <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input type="date" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
            </div>

            <Button className="w-full" onClick={handleCreate} disabled={createPoll.isPending}>
              Crear encuesta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PollCard({
  poll, currentUid, onVote, onClose,
}: {
  poll: GroupPoll
  currentUid: string
  onVote: (optionId: string) => void
  onClose: () => void
}) {
  const isClosed = poll.status === "closed"
  const totalVotes = poll.options.reduce((s, o) => s + o.votes.length, 0)
  const userVote = poll.options.find((o) => o.votes.includes(currentUid))

  return (
    <div className={cn(
      "rounded-xl border p-3 space-y-2.5",
      isClosed ? "bg-muted/30 opacity-80" : "bg-card"
    )}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{poll.question}</p>
        {!isClosed && (
          <button
            onClick={onClose}
            className="text-[10px] text-muted-foreground hover:text-foreground shrink-0 transition-colors"
          >
            Cerrar
          </button>
        )}
        {isClosed && (
          <span className="text-[10px] font-medium text-muted-foreground shrink-0">Cerrada</span>
        )}
      </div>

      <div className="space-y-1.5">
        {poll.options.map((opt) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0
          const isWinner = isClosed && poll.result === opt.id
          const isMyVote = opt.votes.includes(currentUid)
          return (
            <button
              key={opt.id}
              onClick={() => !isClosed && onVote(opt.id)}
              disabled={isClosed}
              className={cn(
                "w-full relative rounded-lg border overflow-hidden text-left transition-colors",
                isWinner ? "border-green-500/50 bg-green-500/10" : isMyVote ? "border-primary/40" : "border-border",
                !isClosed && "hover:border-muted-foreground"
              )}
            >
              {/* Progress background */}
              <div
                className={cn(
                  "absolute inset-0 transition-all",
                  isWinner ? "bg-green-500/15" : "bg-primary/5"
                )}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  {isMyVote && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                  <span className={cn("text-xs font-medium", isWinner && "text-green-700 dark:text-green-400")}>
                    {opt.label}
                    {isWinner && " 🏆"}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {opt.votes.length} voto{opt.votes.length !== 1 ? "s" : ""} · {pct}%
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {poll.closesAt && !isClosed && (
        <p className="text-[10px] text-muted-foreground">
          Cierra: {format(poll.closesAt.toDate(), "d MMM yyyy", { locale: es })}
        </p>
      )}
    </div>
  )
}
