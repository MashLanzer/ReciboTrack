"use client"

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
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

function checklistsCol(groupId: string) {
  return collection(getFirebaseDb(), "groups", groupId, "checklists")
}

export function useGroupChecklists(groupId: string | null) {
  return useQuery({
    queryKey: ["group-checklists", groupId],
    enabled: !!groupId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!groupId) return []
      const q = query(checklistsCol(groupId), orderBy("createdAt", "desc"))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, groupId, ...d.data() }) as GroupChecklist)
    },
  })
}

export function useCreateGroupChecklist() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId,
      title,
      items,
    }: {
      groupId: string
      title: string
      items: string[]
    }) => {
      if (!user) throw new Error("No autenticado")
      const checklistItems: ChecklistItem[] = items
        .filter((t) => t.trim())
        .map((text, i) => ({
          id: `${Date.now()}-${i}`,
          text: text.trim(),
          done: false,
        }))
      await addDoc(checklistsCol(groupId), {
        groupId,
        title,
        items: checklistItems,
        createdByUid: user.uid,
        createdAt: Timestamp.now(),
      })
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
      groupId,
      checklistId,
      itemId,
      currentItems,
      done,
    }: {
      groupId: string
      checklistId: string
      itemId: string
      currentItems: ChecklistItem[]
      done: boolean
    }) => {
      if (!user) throw new Error("No autenticado")
      const updated = currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              done,
              ...(done
                ? {
                    doneByUid: user.uid,
                    doneByName: user.displayName ?? user.email ?? "Usuario",
                    doneAt: Timestamp.now(),
                  }
                : { doneByUid: undefined, doneByName: undefined, doneAt: undefined }),
            }
          : item
      )
      await updateDoc(doc(getFirebaseDb(), "groups", groupId, "checklists", checklistId), {
        items: updated,
      })
    },
    onSuccess: (_, { groupId }) =>
      queryClient.invalidateQueries({ queryKey: ["group-checklists", groupId] }),
  })
}

export function useDeleteGroupChecklist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, checklistId }: { groupId: string; checklistId: string }) => {
      await deleteDoc(doc(getFirebaseDb(), "groups", groupId, "checklists", checklistId))
    },
    onSuccess: (_, { groupId }) =>
      queryClient.invalidateQueries({ queryKey: ["group-checklists", groupId] }),
  })
}

export function useAddChecklistItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId,
      checklistId,
      text,
      currentItems,
    }: {
      groupId: string
      checklistId: string
      text: string
      currentItems: ChecklistItem[]
    }) => {
      const newItem: ChecklistItem = {
        id: `${Date.now()}`,
        text: text.trim(),
        done: false,
      }
      await updateDoc(doc(getFirebaseDb(), "groups", groupId, "checklists", checklistId), {
        items: [...currentItems, newItem],
      })
    },
    onSuccess: (_, { groupId }) =>
      queryClient.invalidateQueries({ queryKey: ["group-checklists", groupId] }),
  })
}
