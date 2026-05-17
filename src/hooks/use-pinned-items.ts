"use client"

import {
  doc,
  getDoc,
  setDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"
import type { PinnedItem } from "@/types"

const MAX_PINNED = 3

function pinnedDoc(uid: string) {
  return doc(getFirebaseDb(), "users", uid, "pinnedItems", "pinned")
}

export function usePinnedItems() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["pinnedItems", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as PinnedItem[]
      const d = await getDoc(pinnedDoc(user.uid))
      if (!d.exists()) return [] as PinnedItem[]
      const data = d.data() as { items?: PinnedItem[] }
      return data.items ?? []
    },
  })
}

export function usePinItem() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (item: PinnedItem) => {
      if (!user) throw new Error("No autenticado")
      const current = queryClient.getQueryData<PinnedItem[]>(["pinnedItems", user.uid]) ?? []
      if (current.length >= MAX_PINNED) throw new Error("Máximo 3 ítems fijados")
      const ref = pinnedDoc(user.uid)
      await setDoc(ref, { items: arrayUnion(item) }, { merge: true })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pinnedItems", user?.uid] })
    },
  })
}

export function useUnpinItem() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (item: PinnedItem) => {
      if (!user) throw new Error("No autenticado")
      const ref = pinnedDoc(user.uid)
      await setDoc(ref, { items: arrayRemove(item) }, { merge: true })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pinnedItems", user?.uid] })
    },
  })
}
