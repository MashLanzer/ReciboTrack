"use client"

import {
  collection, doc, setDoc, deleteDoc, onSnapshot, Timestamp,
} from "firebase/firestore"
import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"

export interface ReactionEntry {
  emoji: string
  userId: string
}

/** Returns reactions grouped by emoji: Map<emoji, ReactionEntry[]> */
export function useGroupReactions(groupId: string, expenseId: string) {
  const [reactions, setReactions] = useState<Map<string, ReactionEntry[]>>(new Map())

  useEffect(() => {
    if (!groupId || !expenseId) return
    const col = collection(
      getFirebaseDb(),
      "groups", groupId, "expenses", expenseId, "reactions"
    )
    const unsub = onSnapshot(col, (snap) => {
      const map = new Map<string, ReactionEntry[]>()
      snap.docs.forEach((d) => {
        const data = d.data() as { emoji: string; updatedAt: Timestamp }
        const entry: ReactionEntry = { emoji: data.emoji, userId: d.id }
        const list = map.get(data.emoji) ?? []
        list.push(entry)
        map.set(data.emoji, list)
      })
      setReactions(map)
    })
    return unsub
  }, [groupId, expenseId])

  return reactions
}

export function useToggleReaction() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      groupId, expenseId, emoji,
    }: { groupId: string; expenseId: string; emoji: string }) => {
      if (!user) throw new Error("No autenticado")
      const ref = doc(
        getFirebaseDb(),
        "groups", groupId, "expenses", expenseId, "reactions", user.uid
      )
      const db = getFirebaseDb()
      // Check if already reacted with same emoji (read from snapshot — handled in component)
      // setDoc overwrites, deleteDoc removes
      const { getDoc } = await import("firebase/firestore")
      const existing = await getDoc(ref)
      if (existing.exists() && (existing.data() as { emoji: string }).emoji === emoji) {
        await deleteDoc(ref)
      } else {
        await setDoc(ref, { emoji, updatedAt: Timestamp.now() })
      }
    },
    onSuccess: (_d, { groupId }) => {
      qc.invalidateQueries({ queryKey: ["group-expenses", groupId] })
    },
  })
}
