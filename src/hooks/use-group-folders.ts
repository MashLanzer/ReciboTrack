"use client"

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
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

function foldersCol(groupId: string) {
  // NOTE: "folders" conflicts with Firebase v12 internal __list__ path.
  // Using "groupFolders" as the subcollection name avoids this.
  return collection(getFirebaseDb(), "groups", groupId, "groupFolders")
}

export function useGroupFolders(groupId: string | null) {
  return useQuery({
    queryKey: ["group-folders", groupId],
    enabled: !!groupId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!groupId) return []
      const q = query(foldersCol(groupId), orderBy("createdAt", "asc"))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, groupId, ...d.data() }) as GroupFolder)
    },
  })
}

export function useCreateGroupFolder() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId,
      name,
      emoji,
      description,
    }: {
      groupId: string
      name: string
      emoji: string
      description?: string
    }) => {
      if (!user) throw new Error("No autenticado")
      // Use setDoc+doc() instead of addDoc() to avoid Firebase v12
      // internal __list__ verification bug on new subcollections
      const newRef = doc(foldersCol(groupId))
      await setDoc(newRef, {
        groupId,
        name,
        emoji,
        ...(description ? { description } : {}),
        createdByUid: user.uid,
        createdAt: Timestamp.now(),
      })
    },
    onSuccess: (_, { groupId }) =>
      queryClient.invalidateQueries({ queryKey: ["group-folders", groupId] }),
  })
}

export function useUpdateGroupFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId,
      folderId,
      name,
      emoji,
      description,
    }: {
      groupId: string
      folderId: string
      name: string
      emoji: string
      description?: string
    }) => {
      await updateDoc(doc(getFirebaseDb(), "groups", groupId, "folders", folderId), {
        name,
        emoji,
        ...(description !== undefined ? { description } : {}),
      })
    },
    onSuccess: (_, { groupId }) =>
      queryClient.invalidateQueries({ queryKey: ["group-folders", groupId] }),
  })
}

export function useDeleteGroupFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, folderId }: { groupId: string; folderId: string }) => {
      await deleteDoc(doc(getFirebaseDb(), "groups", groupId, "folders", folderId))
    },
    onSuccess: (_, { groupId }) =>
      queryClient.invalidateQueries({ queryKey: ["group-folders", groupId] }),
  })
}
