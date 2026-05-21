"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"
import { generatePortalToken, type Portal, type PortalInput } from "@/lib/portal-permissions"

export function usePortals() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["portals", user?.uid],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<Portal[]> => {
      if (!user) return []
      const res = await apiFetch("/api/portals")
      if (!res.ok) throw new Error("Error cargando portales")
      return res.json() as Promise<Portal[]>
    },
  })
}

export function useCreatePortal() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: PortalInput): Promise<Portal> => {
      if (!user) throw new Error("No auth")
      const token = generatePortalToken()
      const now   = new Date().toISOString()

      const res = await apiFetch("/api/portals", {
        method: "POST",
        body: JSON.stringify({
          ...input,
          token,
          ownerName: user.displayName ?? user.email ?? "Usuario",
        }),
      })
      if (!res.ok) throw new Error("Error al crear portal")
      const json = await res.json() as { id: string }

      return {
        id:             json.id,
        ...input,
        token,
        revoked:        false,
        lastAccessedAt: null,
        accessCount:    0,
        ownerUid:       user.uid,
        ownerName:      user.displayName ?? user.email ?? "Usuario",
        createdAt:      now,
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portals", user?.uid] }),
  })
}

export function useRevokePortal() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, revoked }: { id: string; revoked: boolean }) => {
      if (!user) throw new Error("No auth")
      const res = await apiFetch(`/api/portals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ revoked }),
      })
      if (!res.ok) throw new Error("Error al revocar portal")
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portals", user?.uid] }),
  })
}

export function useDeletePortal() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No auth")
      const res = await apiFetch(`/api/portals/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar portal")
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portals", user?.uid] }),
  })
}

export function getPortalUrl(token: string): string {
  if (typeof window === "undefined") return `/portal/${token}`
  return `${window.location.origin}/portal/${token}`
}

export async function findPortalByToken(_token: string): Promise<(Portal & { uid: string }) | null> {
  // La búsqueda por token se hace en el API route /portal/[token] del servidor
  return null
}
