"use client"

import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  Timestamp,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"
import type { TrustedCircleMember, TrustedCircleMemberInput } from "@/types"

function trustedCircleCollection(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "trustedCircle")
}

export function useTrustedCircle() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ["trustedCircle", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as TrustedCircleMember[]
      const col = trustedCircleCollection(user.uid)
      const snap = await getDocs(col)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrustedCircleMember)
    },
  })
}

export function useAddToTrustedCircle() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: TrustedCircleMemberInput) => {
      if (!user) throw new Error("No autenticado")
      const col = trustedCircleCollection(user.uid)
      const ref = await addDoc(col, {
        ...input,
        addedAt: Timestamp.now(),
      })
      return ref.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trustedCircle", user?.uid] })
    },
  })
}

export function useRemoveFromTrustedCircle() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (memberId: string) => {
      if (!user) throw new Error("No autenticado")
      await deleteDoc(doc(getFirebaseDb(), "users", user.uid, "trustedCircle", memberId))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trustedCircle", user?.uid] })
    },
  })
}

export function useUpdateTrustedCirclePermissions() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ memberId, canSeeFullBudget }: { memberId: string; canSeeFullBudget: boolean }) => {
      if (!user) throw new Error("No autenticado")
      await updateDoc(
        doc(getFirebaseDb(), "users", user.uid, "trustedCircle", memberId),
        { canSeeFullBudget }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trustedCircle", user?.uid] })
    },
  })
}
