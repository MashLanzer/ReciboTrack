"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "./use-auth"

export interface Webhook {
  id:          string
  uid:         string
  url:         string
  secret:      string | null
  events:      string[]
  enabled:     boolean
  created_at:  string
  last_fired:  string | null
  last_status: number | null
}

// ── useWebhooks ───────────────────────────────────────────────────────────────

export function useWebhooks() {
  const { user } = useAuth()
  return useQuery<Webhook[]>({
    queryKey: ["webhooks", user?.uid],
    enabled:  !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await apiFetch("/api/webhooks")
      if (!res.ok) throw new Error("Error cargando webhooks")
      return res.json() as Promise<Webhook[]>
    },
  })
}

// ── useCreateWebhook ──────────────────────────────────────────────────────────

export function useCreateWebhook() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { url: string; secret?: string; events?: string[] }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch("/api/webhooks", { method: "POST", body: JSON.stringify(input) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? "Error al crear webhook")
      }
      return res.json() as Promise<{ id: string }>
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks", user?.uid] }),
  })
}

// ── useUpdateWebhook ──────────────────────────────────────────────────────────

export function useUpdateWebhook() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Pick<Webhook, "enabled" | "url" | "events" | "secret">> }) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/webhooks/${id}`, { method: "PATCH", body: JSON.stringify(updates) })
      if (!res.ok) throw new Error("Error al actualizar webhook")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks", user?.uid] }),
  })
}

// ── useDeleteWebhook ──────────────────────────────────────────────────────────

export function useDeleteWebhook() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No autenticado")
      const res = await apiFetch(`/api/webhooks/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar webhook")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks", user?.uid] }),
  })
}
