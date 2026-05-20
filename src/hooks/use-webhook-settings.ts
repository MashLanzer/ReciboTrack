"use client"

/**
 * useWebhookSettings — Lee y escribe la configuración del webhook del usuario
 * en Firestore (users/{uid}) en lugar de localStorage.
 *
 * Migración automática: si hay valores en localStorage los sube a Firestore
 * la primera vez y los borra localmente, para no perder configuraciones existentes.
 */

import { useCallback, useEffect, useState } from "react"
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase/client"
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

  // ── Load from Firestore (+ migrate from localStorage if needed) ──────────
  useEffect(() => {
    if (!user?.uid) return

    let cancelled = false

    async function load() {
      const ref = doc(getFirebaseDb(), "users", user!.uid)
      const snap = await getDoc(ref)
      if (cancelled) return

      const data = snap.data() ?? {}
      let webhookUrl: string = typeof data.webhookUrl === "string" ? data.webhookUrl : ""
      let webhookEvents: string[] = Array.isArray(data.webhookEvents) ? data.webhookEvents as string[] : DEFAULT_EVENTS

      // Migrate from localStorage on first load
      try {
        const lsUrl    = localStorage.getItem("rt-webhook-url")
        const lsEvents = JSON.parse(localStorage.getItem("rt-webhook-events") ?? "null") as string[] | null

        if (lsUrl && !webhookUrl) {
          webhookUrl = lsUrl
          webhookEvents = lsEvents ?? DEFAULT_EVENTS
          // Persist migrated values to Firestore
          await setDoc(ref, { webhookUrl, webhookEvents }, { merge: true })
          // Clean up localStorage
          localStorage.removeItem("rt-webhook-url")
          localStorage.removeItem("rt-webhook-events")
        }
      } catch { /* Safari private / no localStorage */ }

      if (!cancelled) {
        setSettings({ webhookUrl, webhookEvents })
        setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [user?.uid])

  // ── Save ────────────────────────────────────────────────────────────────
  const save = useCallback(async (url: string, events: string[]) => {
    if (!user?.uid) throw new Error("No autenticado")
    const ref = doc(getFirebaseDb(), "users", user.uid)
    await updateDoc(ref, { webhookUrl: url, webhookEvents: events })
    setSettings({ webhookUrl: url, webhookEvents: events })
  }, [user?.uid])

  // ── Remove ───────────────────────────────────────────────────────────────
  const remove = useCallback(async () => {
    if (!user?.uid) return
    const ref = doc(getFirebaseDb(), "users", user.uid)
    await updateDoc(ref, { webhookUrl: "", webhookEvents: DEFAULT_EVENTS })
    setSettings({ webhookUrl: "", webhookEvents: DEFAULT_EVENTS })
  }, [user?.uid])

  return { settings, loading, save, remove }
}
