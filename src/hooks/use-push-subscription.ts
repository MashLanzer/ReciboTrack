"use client"

/**
 * use-push-subscription.ts — gestión de suscripciones Web Push
 *
 * Flujo:
 *   1. El usuario activa "Notificaciones push" en Perfil
 *   2. `subscribe()` llama a PushManager.subscribe() con la VAPID public key
 *   3. La suscripción (endpoint + keys) se envía a /api/push/subscribe
 *   4. El servidor la guarda en users/{uid}/pushSub en Firestore
 *   5. El cron de Vercel llama /api/cron/recurring-reminders que las usa para enviar
 *
 * Requiere NEXT_PUBLIC_VAPID_PUBLIC_KEY en .env.local:
 *   Generar con: npx web-push generate-vapid-keys
 */

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "./use-auth"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  // Usar new Uint8Array(n) para obtener Uint8Array<ArrayBuffer> (no ArrayBufferLike)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

export type PushStatus = "unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading"

export function usePushSubscription() {
  const { user } = useAuth()
  const [status, setStatus] = useState<PushStatus>("loading")

  // Comprobar el estado actual al montar
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported")
      return
    }
    if (Notification.permission === "denied") {
      setStatus("denied")
      return
    }
    // Verificar si ya hay suscripción activa
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setStatus(sub ? "subscribed" : "unsubscribed")
      })
    })
  }, [])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user) return false
    if (!VAPID_PUBLIC_KEY) {
      console.warn("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY no configurado")
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setStatus("denied")
        return false
      }

      const reg = await navigator.serviceWorker.ready
      const existingSub = await reg.pushManager.getSubscription()
      if (existingSub) await existingSub.unsubscribe()

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      // Enviar suscripción al servidor
      const idToken = await user.getIdToken()
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(sub.toJSON()),
      })

      if (!res.ok) {
        await sub.unsubscribe()
        setStatus("unsubscribed")
        return false
      }

      setStatus("subscribed")
      return true
    } catch (err) {
      console.error("[push] Error al suscribir:", err)
      setStatus("unsubscribed")
      return false
    }
  }, [user])

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!user) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()

      const idToken = await user.getIdToken()
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      })

      setStatus("unsubscribed")
    } catch (err) {
      console.error("[push] Error al cancelar suscripción:", err)
    }
  }, [user])

  return { status, subscribe, unsubscribe }
}
