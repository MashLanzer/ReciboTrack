"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "./use-auth"
import type { GroupNote } from "@/types"

export function useGroupNotes(groupId: string) {
  const query = useQuery({
    queryKey: ["group-notes", groupId],
    enabled: !!groupId,
    refetchInterval: 5000,
    queryFn: async (): Promise<GroupNote[]> => {
      if (!groupId) return []
      const res = await apiFetch(`/api/groups/${groupId}/notes`)
      if (!res.ok) return []
      const rows = await res.json() as Array<{
        userId: string; text: string; createdAt: string; expiresAt: string
      }>
      return rows.map((r) => ({
        userId:    r.userId,
        text:      r.text,
        createdAt: Timestamp.fromDate(new Date(r.createdAt)),
        expiresAt: Timestamp.fromDate(new Date(r.expiresAt)),
      }))
    },
  })
  return { data: query.data ?? [], isLoading: query.isLoading }
}

export function usePostGroupNote() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ groupId, text }: { groupId: string; text: string }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/groups/${groupId}/notes`, {
        method: "POST",
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error("Error al publicar nota")
    },
  })
}
