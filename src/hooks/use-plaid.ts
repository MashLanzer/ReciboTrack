"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"

export interface PlaidAccount {
  id:                 string
  item_id:            string
  plaid_account_id:   string
  name:               string | null
  mask:               string | null
  type:               string | null
  subtype:            string | null
  current_balance:    number | null
  available_balance:  number | null
  currency:           string | null
  hidden:             boolean
}

export interface PlaidItem {
  id:                string
  institution_id:    string | null
  institution_name:  string | null
  status:            "active" | "error" | "disconnected"
  error_code:        string | null
  error_message:     string | null
  last_synced_at:    string | null
  logo:              string | null
  primary_color:     string | null
  created_at:        string
  accounts:          PlaidAccount[]
}

/** Lista todos los bancos conectados del usuario. */
export function usePlaidItems() {
  return useQuery({
    queryKey: ["plaid-items"],
    queryFn: async () => {
      const res = await apiFetch("/api/plaid/items")
      if (!res.ok) throw new Error("Error al cargar bancos")
      return (await res.json()) as PlaidItem[]
    },
  })
}

/** Pide un link_token al backend para abrir Plaid Link. */
export function useCreateLinkToken() {
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const res = await apiFetch("/api/plaid/link-token", { method: "POST" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string; upgrade?: string }
        const err = new Error(data.error ?? "Error al crear link token") as Error & { upgrade?: string }
        if (data.upgrade) err.upgrade = data.upgrade
        throw err
      }
      const { link_token } = (await res.json()) as { link_token: string }
      return link_token
    },
  })
}

/** Intercambia public_token por access_token + dispara sync inicial. */
export function useExchangePublicToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      publicToken: string
      institution?: { id: string; name: string }
    }) => {
      const res = await apiFetch("/api/plaid/exchange", {
        method: "POST",
        body: JSON.stringify({
          public_token: input.publicToken,
          institution:  input.institution,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? "Error al conectar banco")
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plaid-items"] })
      qc.invalidateQueries({ queryKey: ["expenses"] })
    },
  })
}

/** Sync manual de un item. */
export function useSyncItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiFetch(`/api/plaid/items/${itemId}/sync`, { method: "POST" })
      if (!res.ok) throw new Error("Error al sincronizar")
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plaid-items"] })
      qc.invalidateQueries({ queryKey: ["expenses"] })
    },
  })
}

/** Pide un link_token en "update mode" para reconectar un item con error. */
export function useReconnectItem() {
  return useMutation({
    mutationFn: async (itemId: string): Promise<string> => {
      const res = await apiFetch(`/api/plaid/items/${itemId}/reconnect`, { method: "POST" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? "Error al iniciar reconexión")
      }
      const { link_token } = (await res.json()) as { link_token: string }
      return link_token
    },
  })
}

/** Actualizar items tras un re-link exitoso (limpia status=error). */
export function useMarkItemActive() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ["plaid-items"] })
}

/** Desconecta un banco. */
export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiFetch(`/api/plaid/items/${itemId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al desconectar")
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plaid-items"] })
    },
  })
}
