"use client"

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"
import type { CategoryDoc } from "@/types"
import { DEFAULT_CATEGORIES } from "@/lib/constants"
import type { CategoryFormInput } from "@/lib/firebase/schemas"

function categoriesCollection(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "categories")
}

export function useCategories() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["categories", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return DEFAULT_CATEGORIES

      const col = categoriesCollection(user.uid)
      const snap = await getDocs(col)

      if (snap.empty) {
        for (const cat of DEFAULT_CATEGORIES) {
          await setDoc(doc(col, cat.id), cat)
        }
        return DEFAULT_CATEGORIES
      }

      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CategoryDoc)
    },
  })
}

export function useAddCategory() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CategoryFormInput) => {
      if (!user) throw new Error("No autenticado")
      const col = categoriesCollection(user.uid)
      const ref = await addDoc(col, { ...input, isDefault: false })
      return ref.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories", user?.uid] }),
  })
}

export function useUpdateCategory() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<CategoryFormInput> }) => {
      if (!user) throw new Error("No autenticado")
      await updateDoc(doc(getFirebaseDb(), "users", user.uid, "categories", id), input)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories", user?.uid] }),
  })
}

export function useDeleteCategory() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      await deleteDoc(doc(getFirebaseDb(), "users", user.uid, "categories", id))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories", user?.uid] }),
  })
}
