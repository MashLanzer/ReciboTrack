"use client"

import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  arrayUnion,
  arrayRemove,
  query,
  orderBy,
} from "firebase/firestore"
import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"
import type { WishlistItem, WishlistItemInput } from "@/types"

function wishlistCollection(groupId: string) {
  return collection(getFirebaseDb(), "groups", groupId, "wishlist")
}

export function useGroupWishlist(groupId: string) {
  const [items, setItems] = useState<WishlistItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!groupId) return
    const col = wishlistCollection(groupId)
    const q = query(col, orderBy("createdAt", "desc"))
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WishlistItem)
      // Sort by likes count desc client-side
      data.sort((a, b) => b.likes.length - a.likes.length)
      setItems(data)
      setIsLoading(false)
    })
    return () => unsub()
  }, [groupId])

  return { data: items, isLoading }
}

export function useAddWishlistItem() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ groupId, input }: { groupId: string; input: WishlistItemInput }) => {
      if (!user) throw new Error("No autenticado")
      const col = wishlistCollection(groupId)
      await addDoc(col, {
        ...input,
        addedBy: user.uid,
        likes: [],
        purchased: false,
        createdAt: Timestamp.now(),
      })
    },
  })
}

export function useLikeWishlistItem() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ groupId, itemId, liked }: { groupId: string; itemId: string; liked: boolean }) => {
      if (!user) throw new Error("No autenticado")
      const ref = doc(getFirebaseDb(), "groups", groupId, "wishlist", itemId)
      await updateDoc(ref, {
        likes: liked ? arrayUnion(user.uid) : arrayRemove(user.uid),
      })
    },
  })
}

export function useMarkWishlistPurchased() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ groupId, itemId }: { groupId: string; itemId: string }) => {
      if (!user) throw new Error("No autenticado")
      const ref = doc(getFirebaseDb(), "groups", groupId, "wishlist", itemId)
      await updateDoc(ref, {
        purchased: true,
        purchasedBy: user.uid,
        purchasedAt: Timestamp.now(),
      })
    },
  })
}
