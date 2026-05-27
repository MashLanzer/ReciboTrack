"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Workspace {
  id: string
  name: string
  owner_uid: string
  created_at: string
  memberCount: number
  role: "owner" | "member"
}

export interface WorkspaceMember {
  id: string
  uid: string
  role: "owner" | "member"
  joined_at: string
}

export interface WorkspaceDetail {
  workspace: Omit<Workspace, "memberCount" | "role">
  members: WorkspaceMember[]
  userRole: "owner" | "member"
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useWorkspaces() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["workspaces", user?.uid],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (!user) return [] as Workspace[]
      const res = await apiFetch("/api/workspaces")
      if (!res.ok) throw new Error("Error cargando espacios")
      const json = await res.json() as { workspaces: Workspace[] }
      return json.workspaces
    },
  })
}

export function useWorkspaceDetail(workspaceId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["workspace-detail", workspaceId, user?.uid],
    enabled: !!user && !!workspaceId,
    staleTime: 15_000,
    queryFn: async () => {
      if (!user || !workspaceId) return null
      const res = await apiFetch(`/api/workspaces/${workspaceId}`)
      if (!res.ok) throw new Error("Error cargando detalles del espacio")
      return await res.json() as WorkspaceDetail
    },
  })
}

export function useCreateWorkspace() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? "Error al crear el espacio")
      }
      return await res.json() as { workspace: Workspace }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces", user?.uid] })
      toast.success("Espacio creado correctamente")
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useDeleteWorkspace() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (workspaceId: string) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/workspaces/${workspaceId}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? "Error al eliminar el espacio")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces", user?.uid] })
      toast.success("Espacio eliminado")
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useWorkspaceMembers(workspaceId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["workspace-members", workspaceId, user?.uid],
    enabled: !!user && !!workspaceId,
    staleTime: 15_000,
    queryFn: async () => {
      if (!user || !workspaceId) return [] as WorkspaceMember[]
      const res = await apiFetch(`/api/workspaces/${workspaceId}`)
      if (!res.ok) throw new Error("Error cargando miembros")
      const json = await res.json() as WorkspaceDetail
      return json.members
    },
  })
}

export function useRemoveMember() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ workspaceId, memberId }: { workspaceId: string; memberId: string }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? "Error al expulsar al miembro")
      }
    },
    onSuccess: (_data, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: ["workspace-detail", workspaceId] })
      queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] })
      queryClient.invalidateQueries({ queryKey: ["workspaces", user?.uid] })
      toast.success("Miembro eliminado del espacio")
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useLeaveWorkspace() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ workspaceId, memberId }: { workspaceId: string; memberId: string }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? "Error al abandonar el espacio")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces", user?.uid] })
      toast.success("Has abandonado el espacio")
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useCreateInvite(workspaceId: string) {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/workspaces/${workspaceId}/invite`, {
        method: "POST",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? "Error al generar la invitación")
      }
      return await res.json() as { token: string; inviteUrl: string }
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
