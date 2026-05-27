"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "./use-auth"

export interface BankConnection {
  id:               string
  uid:              string
  belvo_link_id:    string
  institution:      string
  institution_name: string
  status:           string
  last_synced_at:   string | null
  created_at:       string
}

export function useBankConnections() {
  const { user } = useAuth()
  return useQuery<BankConnection[]>({
    queryKey: ["bank-connections", user?.uid],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await apiFetch("/api/belvo/connections")
      if (!res.ok) throw new Error("Error cargando conexiones bancarias")
      return res.json() as Promise<BankConnection[]>
    },
  })
}

export function useConnectBank() {
  return useMutation({
    mutationFn: async (): Promise<{ token: string }> => {
      const res = await apiFetch("/api/belvo/widget-token", { method: "POST" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? "Error al obtener token de Belvo")
      }
      return res.json() as Promise<{ token: string }>
    },
  })
}

export function useDisconnectBank() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch("/api/belvo/connections", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error("Error al desconectar banco")
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank-connections", user?.uid] }),
  })
}

export function useSyncBank() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (linkId: string) => {
      const res = await apiFetch("/api/belvo/sync", {
        method: "POST",
        body: JSON.stringify({ linkId }),
      })
      if (!res.ok) throw new Error("Error al sincronizar")
      return res.json() as Promise<{ imported: number; skipped: number }>
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] })
      qc.invalidateQueries({ queryKey: ["bank-connections", user?.uid] })
    },
  })
}
