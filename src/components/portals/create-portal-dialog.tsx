"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useCreatePortal } from "@/hooks/use-portals"
import {
  ROLE_PRESETS,
  type PortalRole,
  type PortalPermissions,
} from "@/lib/portal-permissions"
import { ChevronDown, ChevronUp, Lock } from "lucide-react"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated?: (token: string) => void
}

const ROLES: PortalRole[] = ["accountant", "partner", "associate", "custom"]

function defaultPermissions(role: PortalRole): PortalPermissions {
  return { ...ROLE_PRESETS[role].permissions }
}

export function CreatePortalDialog({ open, onOpenChange, onCreated }: Props) {
  const createPortal = useCreatePortal()

  const [step, setStep] = useState<"role" | "config">("role")
  const [selectedRole, setSelectedRole] = useState<PortalRole>("accountant")
  const [name, setName] = useState("")
  const [targetLabel, setTargetLabel] = useState("")
  const [expiresInDays, setExpiresInDays] = useState<string>("30")
  const [perms, setPerms] = useState<PortalPermissions>(defaultPermissions("accountant"))
  const [showAdvanced, setShowAdvanced] = useState(false)

  function selectRole(role: PortalRole) {
    setSelectedRole(role)
    setPerms(defaultPermissions(role))
  }

  function handleClose() {
    setStep("role")
    setSelectedRole("accountant")
    setName("")
    setTargetLabel("")
    setExpiresInDays("30")
    setPerms(defaultPermissions("accountant"))
    setShowAdvanced(false)
    onOpenChange(false)
  }

  async function handleCreate() {
    if (!name.trim()) { toast.error("El nombre es obligatorio"); return }

    let expiresAt: string | null = null
    const days = parseInt(expiresInDays)
    if (!isNaN(days) && days > 0) {
      const d = new Date()
      d.setDate(d.getDate() + days)
      expiresAt = d.toISOString()
    }

    try {
      const portal = await createPortal.mutateAsync({
        name: name.trim(),
        role: selectedRole,
        permissions: perms,
        expiresAt,
        targetLabel: targetLabel.trim(),
      })
      toast.success("Portal creado")
      handleClose()
      onCreated?.(portal.token)
    } catch {
      toast.error("Error al crear el portal")
    }
  }

  const preset = ROLE_PRESETS[selectedRole]

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Nuevo portal compartido
          </DialogTitle>
        </DialogHeader>

        {step === "role" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Elige qué tipo de acceso quieres dar. Podrás ajustar los permisos en el siguiente paso.
            </p>

            {ROLES.map((role) => {
              const p = ROLE_PRESETS[role]
              const isSelected = selectedRole === role
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => selectRole(role)}
                  className={`w-full text-left rounded-xl border p-3.5 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{p.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{p.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{p.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}

            <Button className="w-full" onClick={() => setStep("config")}>
              Continuar con {preset.label}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Role badge */}
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
              <span className="text-lg">{preset.emoji}</span>
              <p className="text-sm font-medium">{preset.label}</p>
              <button
                type="button"
                onClick={() => setStep("role")}
                className="ml-auto text-xs text-primary hover:underline"
              >
                Cambiar
              </button>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label>Nombre del portal *</Label>
              <Input
                placeholder="Ej: Vista para Ana - Contadora 2025"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Target label */}
            <div className="space-y-1.5">
              <Label>Para quién <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input
                placeholder="Ej: Ana García · ana@empresa.com"
                value={targetLabel}
                onChange={(e) => setTargetLabel(e.target.value)}
              />
            </div>

            {/* Expiry */}
            <div className="space-y-1.5">
              <Label>Expira en</Label>
              <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 días</SelectItem>
                  <SelectItem value="30">30 días</SelectItem>
                  <SelectItem value="90">90 días</SelectItem>
                  <SelectItem value="365">1 año</SelectItem>
                  <SelectItem value="0">Sin expiración</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Advanced permissions */}
            <div className="rounded-xl border overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <span>Permisos avanzados</span>
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showAdvanced && (
                <div className="border-t divide-y">
                  {(
                    [
                      { key: "showMerchants",     label: "Ver nombres de comercios" },
                      { key: "showAmounts",        label: "Ver importes" },
                      { key: "showNotes",          label: "Ver notas personales" },
                      { key: "showCategories",     label: "Ver categorías" },
                      { key: "showItems",          label: "Ver ítems del recibo" },
                      { key: "showPaymentMethod",  label: "Ver método de pago" },
                      { key: "showTags",           label: "Ver etiquetas" },
                      { key: "showTotalsOnly",     label: "Solo totales (sin lista)" },
                    ] as { key: keyof PortalPermissions; label: string }[]
                  ).filter(({ key }) => typeof perms[key] === "boolean").map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between px-3 py-2.5">
                      <p className="text-sm">{label}</p>
                      <Switch
                        checked={perms[key] as boolean}
                        onCheckedChange={(v) => setPerms({ ...perms, [key]: v })}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("role")}>
                Atrás
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreate}
                disabled={createPortal.isPending || !name.trim()}
              >
                {createPortal.isPending ? "Creando…" : "Crear portal"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
