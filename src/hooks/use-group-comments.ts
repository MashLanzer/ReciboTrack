"use client"

import {
  collection,
  query,
  orderBy,
  addDoc,
  deleteDoc,
  doc,
  Timestamp,
  getDocs,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"

export interface GroupComment {
  id: string
  uid: string
  displayName: string
  photoURL: string | null
  text: string
  createdAt: Timestamp
}

function commentsCol(groupId: string, expenseId: string) {
  return collection(
    getFirebaseDb(),
    "groups", groupId,
    "expenses", expenseId,
    "comments"
  )
}

export function useGroupComments(groupId: string, expenseId: string) {
  return useQuery({
    queryKey: ["group-comments", groupId, expenseId],
    enabled: !!groupId && !!expenseId,
    queryFn: async () => {
      const q = query(commentsCol(groupId, expenseId), orderBy("createdAt", "asc"))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GroupComment)
    },
  })
}

export function useAddGroupComment(groupId: string, expenseId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error("No autenticado")
      await addDoc(commentsCol(groupId, expenseId), {
        uid: user.uid,
        displayName: user.displayName ?? user.email ?? "Usuario",
        photoURL: user.photoURL ?? null,
        text: text.trim(),
        createdAt: Timestamp.now(),
      })
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["group-comments", groupId, expenseId] }),
  })
}

export function useDeleteGroupComment(groupId: string, expenseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (commentId: string) => {
      await deleteDoc(
        doc(getFirebaseDb(), "groups", groupId, "expenses", expenseId, "comments", commentId)
      )
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["group-comments", groupId, expenseId] }),
  })
}
