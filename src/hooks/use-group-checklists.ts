"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "./use-auth"

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
  doneByUid?: string
  doneByName?: string
  doneAt?: Timestamp
}

export interface GroupChecklist {
  id: string
  groupId: string
  title: string
  items: ChecklistItem[]
  createdByUid: string
  createdAt: Timestamp
}

function rowToChecklist(row: Record<string, unknown>): GroupChecklist {
  return {
    id:           row.id as string,
    groupId:      row.groupId as string,
    title:        row.title as string,
    items:        (row.items as ChecklistItem[]) ?? [],
    createdByUid: (row.createdByUid as string) ?? "",
    createdAt:    row.createdAt
      ? Timestamp.fromDate(new Date(row.createdAt as string))
      : Timestamp.now(),
  }
}

export function useGroupChecklists(groupId: string | null) {
  return useQuery({
    queryKey: ["group-checklists", groupId],
    enabled: !!groupId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!groupId) return []
      const res = await apiFetch(`/api/groups/${groupId}/checklists`)
      if (!res.ok) return []
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToChecklist)
    },
  })
}

export function useCreateGroupChecklist() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId, title, items,
    }: { groupId: string; title: string; items: string[] }) => {
      if (!user) throw new Error("No autenticado")
      const checklistItems: ChecklistItem[] = items
        .filter((t) => t.trim())
        .map((text, i) => ({ id: `${Date.now()}-${i}`, text: text.trim(), done: false }))

      const res = await apiFetch(`/api/groups/${groupId}/checklists`, {
        method: "POST",
        body: JSON.stringify({ title, items: checklistItems }),
      })
      if (!res.ok) throw new Error("Error al crear checklist")
    },
    onSuccess: (_, { groupId }) =>
      queryClient.invalidateQueries({ queryKey: ["group-checklists", groupId] }),
  })
}

export function useToggleChecklistItem() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId, checklistId, itemId, currentItems, done,
    }: {
      groupId: string; checklistId: string; itemId: string
      currentItems: ChecklistItem[]; done: boolean
    }) => {
      if (!user) throw new Error("No autenticado")
      const updated = currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              done,
              ...(done
                ? {
                    doneByUid:  user.uid,
                    doneByName: user.displayName ?? user.email ?? "Usuario",
                    doneAt:     new Date().toISOString(),
                  }
                : { doneByUid: undefined, doneByName: undefined, doneAt: undefined }),
            }
          : item
      )
      const res = await apiFetch(`/api/groups/${groupId}/checklists/${checklistId}`, {
        method: "PATCH",
        body: JSON.stringify({ items: updated }),
      })
      if (!res.ok) throw new Error("Error al actualizar checklist")
    },
    onSuccess: (_, { groupId }) =>
      queryClient.invalidateQueries({ queryKey: ["group-checklists", groupId] }),
  })
}

export function useDeleteGroupChecklist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, checklistId }: { groupId: string; checklistId: string }) => {
      const res = await apiFetch(`/api/groups/${groupId}/checklists/${checklistId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar checklist")
    },
    onSuccess: (_, { groupId }) =>
      queryClient.invalidateQueries({ queryKey: ["group-checklists", groupId] }),
  })
}

export function useAddChecklistItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId, checklistId, text, currentItems,
    }: {
      groupId: string; checklistId: string; text: string; currentItems: ChecklistItem[]
    }) => {
      const newItem: ChecklistItem = {
        id:   `${Date.now()}`,
        text: text.trim(),
        done: false,
      }
      const res = await apiFetch(`/api/groups/${groupId}/checklists/${checklistId}`, {
        method: "PATCH",
        body: JSON.stringify({ items: [...currentItems, newItem] }),
      })
      if (!res.ok) throw new Error("Error al agregar ítem")
    },
    onSuccess: (_, { groupId }) =>
      queryClient.invalidateQueries({ queryKey: ["group-checklists", groupId] }),
  })
}
