"use client"

import { Timestamp } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "./use-auth"
import type { Client, ClientInput } from "@/types"
import { apiFetch } from "@/lib/api-client"

function rowToClient(row: Record<string, unknown>): Client {
  return {
    id:        row.id as string,
    name:      row.name as string,
    email:     (row.email as string) ?? undefined,
    phone:     (row.phone as string) ?? undefined,
    notes:     (row.notes as string) ?? undefined,
    color:     (row.color as string) ?? "#6b7280",
    isActive:  (row.isActive as boolean) ?? true,
    createdAt: row.createdAt ? Timestamp.fromDate(new Date(row.createdAt as string)) : Timestamp.now(),
  }
}

export function useClients() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["clients", user?.uid],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as Client[]
      const res = await apiFetch("/api/clients")
      if (!res.ok) throw new Error("Error cargando clientes")
      const rows = await res.json() as Record<string, unknown>[]
      return rows.map(rowToClient)
    },
  })
}

export function useAddClient() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ClientInput) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch("/api/clients", { method: "POST", body: JSON.stringify(input) })
      if (!res.ok) throw new Error("Error al crear cliente")
      const json = await res.json() as { id: string }
      return json.id
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
      const res = await apiFetch(`/api/clients/${id}`, { method: "PATCH", body: JSON.stringify(input) })
      if (!res.ok) throw new Error("Error al actualizar cliente")
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
      const res = await apiFetch(`/api/clients/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar cliente")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients", user?.uid] }),
  })
}
