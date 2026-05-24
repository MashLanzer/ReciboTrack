"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Copy, Trash2, Eye, EyeOff, ExternalLink, Clock, Users } from "lucide-react"
import { useRevokePortal, useDeletePortal, getPortalUrl } from "@/hooks/use-portals"
import { ROLE_PRESETS, type Portal } from "@/lib/portal-permissions"
import { format, formatDistanceToNow, isPast } from "date-fns"
import { es } from "date-fns/locale"

interface Props {
  portal: Portal
}

export function PortalCard({ portal }: Props) {
  const revokePortal = useRevokePortal()
  const deletePortal = useDeletePortal()
  const [deleting, setDeleting] = useState(false)

  const isExpired  = !!portal.expiresAt && isPast(new Date(portal.expiresAt))
  const isRevoked  = portal.revoked
  const isActive   = !isExpired && !isRevoked
  const portalUrl  = getPortalUrl(portal.token)
  const preset     = ROLE_PRESETS[portal.role]

  function copyLink() {
    navigator.clipboard.writeText(portalUrl)
    toast.success("Enlace copiado")
  }

  async function toggleRevoke() {
    try {
      await revokePortal.mutateAsync({ id: portal.id, revoked: !portal.revoked })
      toast.success(portal.revoked ? "Portal reactivado" : "Portal revocado")
    } catch {
      toast.error("Error al actualizar el portal")
    }
  }

  async function handleDelete() {
    if (!deleting) { setDeleting(true); return }
    try {
      await deletePortal.mutateAsync(portal.id)
      toast.success("Portal eliminado")
    } catch {
      toast.error("Error al eliminar")
      setDeleting(false)
    }
  }

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-opacity ${!isActive ? "opacity-60" : ""}`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0 mt-0.5">{preset.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate">{portal.name}</p>
            {isActive   && <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-700 dark:text-green-400">Activo</Badge>}
            {isRevoked  && <Badge variant="secondary" className="text-xs bg-orange-500/10 text-orange-700 dark:text-orange-400">Revocado</Badge>}
            {isExpired  && <Badge variant="secondary" className="text-xs bg-red-500/10 text-red-700 dark:text-red-400">Expirado</Badge>}
          </div>
          {portal.targetLabel && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Users className="h-3 w-3" />
              {portal.targetLabel}
            </p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {portal.expiresAt && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {isExpired
              ? `Expiró ${formatDistanceToNow(new Date(portal.expiresAt), { locale: es, addSuffix: true })}`
              : `Expira ${format(new Date(portal.expiresAt), "d MMM yyyy", { locale: es })}`
            }
          </span>
        )}
        <span>
          {portal.accessCount} {portal.accessCount === 1 ? "acceso" : "accesos"}
          {portal.lastAccessedAt && ` · Último ${formatDistanceToNow(new Date(portal.lastAccessedAt), { locale: es, addSuffix: true })}`}
        </span>
      </div>

      {/* Permission badges */}
      <div className="flex flex-wrap gap-1">
        {!portal.permissions.showMerchants && <PermBadge label="Sin comercios" />}
        {!portal.permissions.showNotes     && <PermBadge label="Sin notas" />}
        {!portal.permissions.showAmounts   && <PermBadge label="Sin importes" />}
        {portal.permissions.showTotalsOnly && <PermBadge label="Solo totales" />}
        {portal.permissions.allowedCategories.length > 0 && (
          <PermBadge label={`${portal.permissions.allowedCategories.length} categorías`} />
        )}
        {portal.permissions.dateRange && <PermBadge label="Rango de fechas" />}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-8 text-xs gap-1.5"
          onClick={copyLink}
          disabled={!isActive}
        >
          <Copy className="h-3 w-3" />
          Copiar enlace
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5"
          onClick={() => window.open(portalUrl, "_blank")}
          disabled={!isActive}
        >
          <ExternalLink className="h-3 w-3" />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className={`h-8 text-xs gap-1.5 ${isRevoked ? "text-green-600 hover:text-green-700" : "text-orange-600 hover:text-orange-700"}`}
          onClick={toggleRevoke}
          disabled={isExpired || revokePortal.isPending}
        >
          {isRevoked ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {isRevoked ? "Reactivar" : "Revocar"}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className={`h-8 text-xs gap-1.5 ${deleting ? "text-destructive" : "text-muted-foreground hover:text-destructive"}`}
          onClick={handleDelete}
          disabled={deletePortal.isPending}
        >
          <Trash2 className="h-3 w-3" />
          {deleting ? "¿Confirmar?" : ""}
        </Button>
      </div>
    </div>
  )
}

function PermBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {label}
    </span>
  )
}
