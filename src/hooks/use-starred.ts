"use client"

import { doc, getDoc, updateDoc, setDoc, arrayUnion, arrayRemove } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"

export interface StarredData {
  categories: string[]
  merchants: string[]
}

const EMPTY: StarredData = { categories: [], merchants: [] }

function starredRef(uid: string) {
  return doc(getFirebaseDb(), "users", uid, "starred", "data")
}

export function useStarred() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["starred", user?.uid],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<StarredData> => {
      if (!user) return EMPTY
      const snap = await getDoc(starredRef(user.uid))
      if (!snap.exists()) return EMPTY
      return { ...EMPTY, ...(snap.data() as Partial<StarredData>) }
    },
  })
}

export function useToggleStarCategory() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ categoryId, isStarred }: { categoryId: string; isStarred: boolean }) => {
      if (!user) throw new Error("No autenticado")
      const ref = starredRef(user.uid)
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        await setDoc(ref, { categories: isStarred ? [] : [categoryId], merchants: [] })
      } else {
        await updateDoc(ref, {
          categories: isStarred ? arrayRemove(categoryId) : arrayUnion(categoryId),
        })
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["starred", user?.uid] }),
  })
}

export function useToggleStarMerchant() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ merchant, isStarred }: { merchant: string; isStarred: boolean }) => {
      if (!user) throw new Error("No autenticado")
      const ref = starredRef(user.uid)
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        await setDoc(ref, { categories: [], merchants: isStarred ? [] : [merchant] })
      } else {
        await updateDoc(ref, {
          merchants: isStarred ? arrayRemove(merchant) : arrayUnion(merchant),
        })
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["starred", user?.uid] }),
  })
}
