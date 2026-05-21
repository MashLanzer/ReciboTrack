"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "./use-auth"

export interface GroupComment {
  id: string
  uid: string
  displayName: string
  photoURL: string | null
  text: string
  createdAt: Timestamp
}

function rowToComment(row: Record<string, unknown>): GroupComment {
  return {
    id:          row.id as string,
    uid:         row.uid as string,
    displayName: (row.displayName as string) ?? "",
    photoURL:    (row.photoURL as string) ?? null,
    text:        row.text as string,
    createdAt:   row.createdAt
      ? Timestamp.fromDate(new Date(row.createdAt as string))
      : Timestamp.now(),
  }
}

export function useGroupComments(groupId: string, expenseId: string) {
  return useQuery({
    queryKey: ["group-comments", groupId, expenseId],
    enabled: !!groupId && !!expenseId,
    queryFn: async () => {
      const res = await apiFetch(`/api/groups/${groupId}/expenses/${expenseId}/comments`)
      if (!res.ok) return []
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToComment)
    },
  })
}

export function useAddGroupComment(groupId: string, expenseId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/groups/${groupId}/expenses/${expenseId}/comments`, {
        method: "POST",
        body: JSON.stringify({
          text:        text.trim(),
          displayName: user.displayName ?? user.email ?? "Usuario",
          photoURL:    user.photoURL ?? null,
        }),
      })
      if (!res.ok) throw new Error("Error al publicar comentario")
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["group-comments", groupId, expenseId] }),
  })
}

export function useDeleteGroupComment(groupId: string, expenseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (commentId: string) => {
      const res = await apiFetch(
        `/api/groups/${groupId}/expenses/${expenseId}/comments/${commentId}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error("Error al eliminar comentario")
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["group-comments", groupId, expenseId] }),
  })
}
