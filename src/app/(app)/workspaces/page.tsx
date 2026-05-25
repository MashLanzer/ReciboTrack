"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import {
  useWorkspaces,
  useCreateWorkspace,
  useDeleteWorkspace,
  useWorkspaceDetail,
  useRemoveMember,
  useLeaveWorkspace,
  useCreateInvite,
  type Workspace,
} from "@/hooks/use-workspaces"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { EmptyState } from "@/components/ui/empty-state"
import { toast } from "sonner"
import {
  Users,
  Plus,
  Link as LinkIcon,
  Trash2,
  LogOut,
  Crown,
  Copy,
  X,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(uid: string): string {
  return uid.slice(0, 2).toUpperCase()
}

// ─── Create workspace dialog ──────────────────────────────────────────────────

function CreateWorkspaceDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const createWorkspace = useCreateWorkspace()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await createWorkspace.mutateAsync(name.trim())
    setName("")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Crear espacio compartido</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Nombre del espacio</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Gastos del hogar"
              maxLength={80}
              autoFocus
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || createWorkspace.isPending}
            >
              {createWorkspace.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Crear
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Workspace detail dialog ──────────────────────────────────────────────────

function WorkspaceDetailDialog({
  workspace,
  onClose,
}: {
  workspace: Workspace
  onClose: () => void
}) {
  const { user } = useAuth()
  const { data: detail, isLoading } = useWorkspaceDetail(workspace.id)
  const removeMember = useRemoveMember()
  const leaveWorkspace = useLeaveWorkspace()
  const deleteWorkspace = useDeleteWorkspace()
  const createInvite = useCreateInvite(workspace.id)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)

  const isOwner = workspace.role === "owner"
  const currentMember = detail?.members.find((m) => m.uid === user?.uid)

  async function handleGenerateInvite() {
    const result = await createInvite.mutateAsync()
    setInviteUrl(result.inviteUrl)
  }

  async function handleCopyLink() {
    if (!inviteUrl) {
      const result = await createInvite.mutateAsync()
      await navigator.clipboard.writeText(result.inviteUrl)
      setInviteUrl(result.inviteUrl)
    } else {
      await navigator.clipboard.writeText(inviteUrl)
    }
    toast.success("Enlace copiado al portapapeles")
  }

  async function handleRemoveMember(memberId: string) {
    await removeMember.mutateAsync({ workspaceId: workspace.id, memberId })
  }

  async function handleLeave() {
    if (!currentMember) return
    await leaveWorkspace.mutateAsync({ workspaceId: workspace.id, memberId: currentMember.id })
    onClose()
  }

  async function handleDelete() {
    await deleteWorkspace.mutateAsync(workspace.id)
    onClose()
  }

  return (
    <>
      <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              {workspace.name}
              {isOwner && (
                <Badge variant="outline" className="ml-1 text-xs">
                  <Crown className="h-3 w-3 mr-1" />
                  Propietario
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Invite link section (owner only) */}
          {isOwner && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Invitar personas</p>
              {inviteUrl ? (
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={inviteUrl}
                    className="text-xs font-mono"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleCopyLink}
                    aria-label="Copiar enlace"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateInvite}
                  disabled={createInvite.isPending}
                  className="w-full"
                >
                  {createInvite.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    : <LinkIcon className="h-4 w-4 mr-2" />
                  }
                  Generar enlace de invitación
                </Button>
              )}
            </div>
          )}

          {/* Members list */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Miembros{" "}
              <span className="text-muted-foreground font-normal">
                ({isLoading ? "…" : (detail?.members.length ?? 0)})
              </span>
            </p>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {(detail?.members ?? []).map((member) => {
                  const isSelf = member.uid === user?.uid
                  const isOwnerRow = member.role === "owner"
                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 bg-muted/40"
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(member.uid)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono truncate text-foreground">
                          {member.uid}
                          {isSelf && <span className="ml-1 text-muted-foreground">(tú)</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Unido{" "}
                          {format(new Date(member.joined_at), "d MMM yyyy", { locale: es })}
                        </p>
                      </div>

                      {isOwnerRow && (
                        <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      )}

                      {/* Remove button (owner only, not for self or other owner) */}
                      {isOwner && !isSelf && !isOwnerRow && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={removeMember.isPending}
                          className="shrink-0 h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          aria-label="Expulsar miembro"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2 border-t">
            {!isOwner && currentMember && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmLeave(true)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Abandonar espacio
              </Button>
            )}
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar espacio
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Eliminar espacio?"
        description={`Se eliminará "${workspace.name}" y todos sus miembros perderán el acceso. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDelete}
      />

      {/* Confirm leave */}
      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="¿Abandonar espacio?"
        description={`Dejarás de tener acceso a "${workspace.name}". Necesitarás una nueva invitación para volver a unirte.`}
        confirmLabel="Abandonar"
        variant="destructive"
        onConfirm={handleLeave}
      />
    </>
  )
}

// ─── Workspace card ───────────────────────────────────────────────────────────

function WorkspaceCard({
  workspace,
  onClick,
}: {
  workspace: Workspace
  onClick: () => void
}) {
  const isOwner = workspace.role === "owner"

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md hover:border-primary/30 active:scale-[0.99]",
        "select-none"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-tight">
            {workspace.name}
          </CardTitle>
          <Badge
            variant={isOwner ? "default" : "secondary"}
            className="shrink-0 text-xs"
          >
            {isOwner ? (
              <>
                <Crown className="h-2.5 w-2.5 mr-1" />
                Propietario
              </>
            ) : (
              "Miembro"
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span className="text-sm">
            {workspace.memberCount > 0
              ? `${workspace.memberCount} miembro${workspace.memberCount !== 1 ? "s" : ""}`
              : "Sin miembros aún"}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkspacesPage() {
  const { data: workspaces = [], isLoading } = useWorkspaces()
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Espacios compartidos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Comparte gastos con tu pareja, familia o socios
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Crear espacio
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin espacios aún"
          description="Crea un espacio compartido e invita a personas para colaborar en el seguimiento de gastos."
          actions={[
            {
              label: "Crear primer espacio",
              onClick: () => setCreateOpen(true),
              icon: <Plus className="h-4 w-4" />,
            },
          ]}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {workspaces.map((ws) => (
            <WorkspaceCard
              key={ws.id}
              workspace={ws}
              onClick={() => setSelectedWorkspace(ws)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreateWorkspaceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      {selectedWorkspace && (
        <WorkspaceDetailDialog
          workspace={selectedWorkspace}
          onClose={() => setSelectedWorkspace(null)}
        />
      )}
    </div>
  )
}
