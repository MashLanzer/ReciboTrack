"use client"

import { useState } from "react"
import {
  useTrustedCircle,
  useAddToTrustedCircle,
  useRemoveFromTrustedCircle,
  useUpdateTrustedCirclePermissions,
} from "@/hooks/use-trusted-circle"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, Plus, Trash2, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
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

// ── H-1: Lookup de usuario por email via /api/user-lookup ────────────────────

interface LookupResult {
  uid: string
  displayName: string
  photoURL: string | null
}

type LookupState = "idle" | "loading" | "found" | "not_found" | "error"

async function lookupUserByEmail(
  email: string,
  idToken: string
): Promise<LookupResult | null> {
  const res = await fetch("/api/user-lookup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ email }),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Error al buscar usuario")
  return res.json() as Promise<LookupResult>
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function TrustedCircleCard() {
  const { user } = useAuth()
  const { data: members = [], isLoading } = useTrustedCircle()
  const addMember = useAddToTrustedCircle()
  const removeMember = useRemoveFromTrustedCircle()
  const updatePermissions = useUpdateTrustedCirclePermissions()

  const [showForm, setShowForm] = useState(false)
  const [emailInput, setEmailInput] = useState("")
  const [lookupState, setLookupState] = useState<LookupState>("idle")
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null)
  const [removeTarget, setRemoveTarget] = useState<{ id: string; displayName: string } | null>(null)

  async function handleEmailBlur() {
    const email = emailInput.trim().toLowerCase()
    if (!email || !email.includes("@")) return
    if (!user) return

    // No volver a buscar si ya tenemos resultado para este email
    if (lookupResult && lookupState === "found") return

    setLookupState("loading")
    setLookupResult(null)

    try {
      const idToken = await user.getIdToken()
      const result = await lookupUserByEmail(email, idToken)
      if (result) {
        setLookupResult(result)
        setLookupState("found")
      } else {
        setLookupState("not_found")
      }
    } catch {
      setLookupState("error")
    }
  }

  function handleEmailChange(v: string) {
    setEmailInput(v)
    // Resetear estado si el usuario cambia el email
    if (lookupState !== "idle") {
      setLookupState("idle")
      setLookupResult(null)
    }
  }

  async function handleAdd() {
    const email = emailInput.trim().toLowerCase()
    if (!email) return

    // Si el lookup ya encontró al usuario, usar sus datos reales
    const resolvedUid  = lookupResult?.uid ?? email // fallback al email si no hay UID
    const resolvedName = lookupResult?.displayName ?? email.split("@")[0]
    const isLinked     = lookupResult !== null

    try {
      await addMember.mutateAsync({
        userId:        resolvedUid,
        displayName:   resolvedName,
        email:         email,
        canSeeFullBudget: false,
        linked:        isLinked,  // true si hay un UID real en el directorio
      })

      toast.success(
        isLinked
          ? `${resolvedName} añadido al círculo`
          : `${resolvedName} añadido (invitación pendiente — aún no tiene cuenta)`,
        { duration: 5000 }
      )

      setEmailInput("")
      setLookupState("idle")
      setLookupResult(null)
      setShowForm(false)
    } catch {
      toast.error("Error al añadir persona")
    }
  }

  return (
    <>
    <ConfirmDialog
      open={!!removeTarget}
      onOpenChange={(o) => { if (!o) setRemoveTarget(null) }}
      title={`¿Eliminar a "${removeTarget?.displayName}" del círculo?`}
      description="Ya no podrá ver tu información financiera compartida."
      confirmLabel="Eliminar"
      onConfirm={async () => {
        if (!removeTarget) return
        try {
          await removeMember.mutateAsync(removeTarget.id)
          toast.success(`${removeTarget.displayName} eliminado del círculo`)
        } catch { toast.error("Error al eliminar") }
      }}
    />
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
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold truncate">{member.displayName}</p>
                    {(member as { linked?: boolean }).linked === false && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning">
                        Pendiente
                      </span>
                    )}
                  </div>
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
                    onClick={() => setRemoveTarget({ id: member.id, displayName: member.displayName })}
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
            <div className="relative">
              <Input
                value={emailInput}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={handleEmailBlur}
                placeholder="Email de la persona"
                className="h-8 text-sm pr-8"
                type="email"
                autoFocus
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {lookupState === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                {lookupState === "found"   && <CheckCircle  className="h-3.5 w-3.5 text-green-500" />}
                {lookupState === "not_found" && <AlertCircle className="h-3.5 w-3.5 text-warning" />}
              </div>
            </div>

            {/* Feedback del lookup */}
            {lookupState === "found" && lookupResult && (
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Usuario encontrado: <span className="font-semibold">{lookupResult.displayName}</span>
              </p>
            )}
            {lookupState === "not_found" && (
              <p className="text-xs text-warning flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                No tiene cuenta en ReciboTrack — se guardará como invitación pendiente
              </p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => { setShowForm(false); setEmailInput(""); setLookupState("idle"); setLookupResult(null) }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={handleAdd}
                disabled={!emailInput.trim() || addMember.isPending || lookupState === "loading"}
              >
                {addMember.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
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
    </>
  )
}
