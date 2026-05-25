"use client"
import { useState, useEffect } from "react"
import { useAuth } from "./use-auth"
import { apiFetch } from "@/lib/api-client"

export function usePushNotifications() {
  const { user } = useAuth()
  const [permission, setPermission] = useState<NotificationPermission>("default")

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission)
  }, [])

  async function subscribe() {
    const reg = await navigator.serviceWorker.register("/sw.js")
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    })
    setPermission("granted")
    await apiFetch("/api/push/subscribe", { method: "POST", body: JSON.stringify({ subscription: sub.toJSON() }) })
  }

  async function requestAndSubscribe() {
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === "granted") await subscribe()
  }

  return { permission, requestAndSubscribe }
}
