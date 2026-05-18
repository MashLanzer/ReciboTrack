"use client"

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFirebaseDb } from "@/lib/firebase/client"
import { useAuth } from "./use-auth"
import type { Client, ClientInput } from "@/types"

function clientsCol(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "clients")
}

export function useClients() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["clients", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return []
      const q = query(clientsCol(user.uid), orderBy("name", "asc"))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Client)
    },
  })
}

export function useAddClient() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ClientInput) => {
      if (!user) throw new Error("No autenticado")
      const ref = await addDoc(clientsCol(user.uid), {
        ...input,
        createdAt: Timestamp.now(),
      })
      return ref.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients", user?.uid] }),
  })
}

export function useUpdateClient() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<ClientInput> }) => {
      if (!user) throw new Error("No autenticado")
      await updateDoc(doc(getFirebaseDb(), "users", user.uid, "clients", id), input)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients", user?.uid] }),
  })
}

export function useDeleteClient() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      await deleteDoc(doc(getFirebaseDb(), "users", user.uid, "clients", id))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients", user?.uid] }),
  })
}
