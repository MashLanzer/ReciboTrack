"use client"

import {
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore"
import { useEffect, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"
import type { GroupNote } from "@/types"

function notesCollection(groupId: string) {
  return collection(getFirebaseDb(), "groups", groupId, "notes")
}

const NOTE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export function useGroupNotes(groupId: string) {
  const [notes, setNotes] = useState<GroupNote[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!groupId) return
    const col = notesCollection(groupId)
    const unsub = onSnapshot(col, async (snap) => {
      const now = Timestamp.now()
      const valid: GroupNote[] = []
      const expiredIds: string[] = []

      for (const d of snap.docs) {
        const data = { userId: d.id, ...d.data() } as GroupNote
        if (data.expiresAt.toMillis() > now.toMillis()) {
          valid.push(data)
        } else {
          expiredIds.push(d.id)
        }
      }

      // Auto-delete expired notes (fire and forget)
      for (const id of expiredIds) {
        void deleteDoc(doc(getFirebaseDb(), "groups", groupId, "notes", id))
      }

      setNotes(valid)
      setIsLoading(false)
    })
    return () => unsub()
  }, [groupId])

  return { data: notes, isLoading }
}

export function usePostGroupNote() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ groupId, text }: { groupId: string; text: string }) => {
      if (!user) throw new Error("No autenticado")
      const now = Timestamp.now()
      const expiresAt = Timestamp.fromMillis(now.toMillis() + NOTE_TTL_MS)
      // setDoc uses userId as document ID (one doc per user, overwritten)
      await setDoc(doc(getFirebaseDb(), "groups", groupId, "notes", user.uid), {
        text,
        createdAt: now,
        expiresAt,
      })
    },
  })
}
