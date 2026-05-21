"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "./use-auth"

export interface GroupFolder {
  id: string
  groupId: string
  name: string
  emoji: string
  description?: string
  createdByUid: string
  createdAt: Timestamp
}

function rowToFolder(row: Record<string, unknown>): GroupFolder {
  return {
    id:           row.id as string,
    groupId:      row.groupId as string,
    name:         row.name as string,
    emoji:        (row.emoji as string) ?? "📁",
    description:  (row.description as string) ?? undefined,
    createdByUid: (row.createdByUid as string) ?? "",
    createdAt:    row.createdAt
      ? Timestamp.fromDate(new Date(row.createdAt as string))
      : Timestamp.now(),
  }
}

export function useGroupFolders(groupId: string | null) {
  return useQuery({
    queryKey: ["group-folders", groupId],
    enabled: !!groupId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!groupId) return []
      const res = await apiFetch(`/api/groups/${groupId}/folders`)
      if (!res.ok) return []
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToFolder)
    },
  })
}

export function useCreateGroupFolder() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId, name, emoji, description,
    }: { groupId: string; name: string; emoji: string; description?: string }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/groups/${groupId}/folders`, {
        method: "POST",
        body: JSON.stringify({ name, emoji, description }),
      })
      if (!res.ok) throw new Error("Error al crear carpeta")
    },
    onSuccess: (_, { groupId }) =>
      queryClient.invalidateQueries({ queryKey: ["group-folders", groupId] }),
  })
}

export function useUpdateGroupFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId, folderId, name, emoji, description,
    }: { groupId: string; folderId: string; name: string; emoji: string; description?: string }) => {
      const res = await apiFetch(`/api/groups/${groupId}/folders/${folderId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, emoji, description }),
      })
      if (!res.ok) throw new Error("Error al actualizar carpeta")
    },
    onSuccess: (_, { groupId }) =>
      queryClient.invalidateQueries({ queryKey: ["group-folders", groupId] }),
  })
}

export function useDeleteGroupFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, folderId }: { groupId: string; folderId: string }) => {
      const res = await apiFetch(`/api/groups/${groupId}/folders/${folderId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar carpeta")
    },
    onSuccess: (_, { groupId }) =>
      queryClient.invalidateQueries({ queryKey: ["group-folders", groupId] }),
  })
}
