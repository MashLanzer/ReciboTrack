"use client"

import { useState } from "react"
import {
  useTrustedCircle,
  useAddToTrustedCircle,
  useRemoveFromTrustedCircle,
  useUpdateTrustedCirclePermissions,
} from "@/hooks/use-trusted-circle"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${checked ? "bg-primary" : "bg-input"}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  )
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

export function TrustedCircleCard() {
  const { data: members = [], isLoading } = useTrustedCircle()
  const addMember = useAddToTrustedCircle()
  const removeMember = useRemoveFromTrustedCircle()
  const updatePermissions = useUpdateTrustedCirclePermissions()

  const [showForm, setShowForm] = useState(false)
  const [emailInput, setEmailInput] = useState("")
  const [nameInput, setNameInput] = useState("")

  async function handleAdd() {
    if (!emailInput.trim() || !nameInput.trim()) return
    try {
      await addMember.mutateAsync({
        userId: emailInput.trim(),
        displayName: nameInput.trim(),
        email: emailInput.trim(),
        canSeeFullBudget: false,
      })
      toast.success(`${nameInput} añadido al círculo`)
      setEmailInput("")
      setNameInput("")
      setShowForm(false)
    } catch {
      toast.error("Error al añadir persona")
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Círculo de confianza
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Personas de confianza que pueden ver información adicional de tu perfil financiero.
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : members.length === 0 ? (
          <div className="rounded-xl bg-muted/30 border border-dashed border-border/60 p-4 text-center">
            <p className="text-sm text-muted-foreground">Nadie en tu círculo aún</p>
            <p className="text-xs text-muted-foreground mt-0.5">Añade personas de confianza</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-xl border p-2.5"
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {getInitials(member.displayName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{member.displayName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{member.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col items-end gap-0.5">
                    <p className="text-[10px] text-muted-foreground">Ver presupuesto</p>
                    <Toggle
                      checked={member.canSeeFullBudget}
                      onChange={(v) => updatePermissions.mutate({ memberId: member.id, canSeeFullBudget: v })}
                    />
                  </div>
                  <button
                    onClick={async () => {
                      await removeMember.mutateAsync(member.id)
                      toast.success(`${member.displayName} eliminado del círculo`)
                    }}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="space-y-2 rounded-xl border p-3 bg-muted/20">
            <Input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Nombre"
              className="h-8 text-sm"
              autoFocus
            />
            <Input
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Email o ID"
              className="h-8 text-sm"
              type="email"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={handleAdd}
                disabled={!emailInput.trim() || !nameInput.trim() || addMember.isPending}
              >
                Añadir
              </Button>
            </div>
          </div>
        )}

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/60 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-border transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Añadir persona
          </button>
        )}
      </CardContent>
    </Card>
  )
}
