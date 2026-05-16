"use client"

import { useEffect } from "react"
import { useBudgetNotifications, requestNotificationPermission } from "@/hooks/use-notifications"
import { useAnomalyDetector } from "@/hooks/use-anomaly-detector"

export function NotificationInit() {
  useBudgetNotifications()
  useAnomalyDetector()

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      // Request permission after a small delay so it doesn't appear immediately on load
      const timer = setTimeout(() => requestNotificationPermission(), 5000)
      return () => clearTimeout(timer)
    }
  }, [])

  return null
}
