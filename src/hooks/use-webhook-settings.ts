"use client"

/**
 * useWebhookSettings — Lee y escribe la configuración del webhook del usuario
 * en Supabase (tabla profiles, campos webhook_url y webhook_events).
 */

import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-client"
import { useAuth } from "@/hooks/use-auth"

export interface WebhookSettings {
  webhookUrl: string
  webhookEvents: string[]
}

const DEFAULT_EVENTS = ["new_expense"]

export function useWebhookSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<WebhookSettings>({ webhookUrl: "", webhookEvents: DEFAULT_EVENTS })
  const [loading, setLoading] = useState(true)

  // ── Load from Supabase via /api/profile ──────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return

    let cancelled = false

    async function load() {
      try {
        const res = await apiFetch("/api/profile")
        if (cancelled) return

        if (res.ok) {
          const data = await res.json() as Record<string, unknown>
          // API devuelve snake_case (columnas de Supabase)
          const webhookUrl: string = typeof data.webhook_url === "string" ? data.webhook_url : ""
          const webhookEvents: string[] = Array.isArray(data.webhook_events) ? data.webhook_events as string[] : DEFAULT_EVENTS
          if (!cancelled) setSettings({ webhookUrl, webhookEvents })
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [user?.uid])

  // ── Save ────────────────────────────────────────────────────────────────
  const save = useCallback(async (url: string, events: string[]) => {
    if (!user?.uid) throw new Error("No autenticado")
    const res = await apiFetch("/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ webhookUrl: url, webhookEvents: events }),
    })
    if (!res.ok) throw new Error("Error al guardar webhook")
    setSettings({ webhookUrl: url, webhookEvents: events })
  }, [user?.uid])

  // ── Remove ───────────────────────────────────────────────────────────────
  const remove = useCallback(async () => {
    if (!user?.uid) return
    const res = await apiFetch("/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ webhookUrl: "", webhookEvents: DEFAULT_EVENTS }),
    })
    if (!res.ok) throw new Error("Error al eliminar webhook")
    setSettings({ webhookUrl: "", webhookEvents: DEFAULT_EVENTS })
  }, [user?.uid])

  return { settings, loading, save, remove }
}
