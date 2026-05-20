"use client"

import { useEffect } from "react"
import { useBudgetNotifications, requestNotificationPermission } from "@/hooks/use-notifications"

// NOTE: useAnomalyDetector is intentionally NOT called here.
// The layout already mounts <AnomalyDetector /> which runs that hook.
// Calling it a second time here would create duplicate sessionStorage keys
// and fire two separate useEffect evaluations on the same data.

export function NotificationInit() {
  useBudgetNotifications()

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      // Request permission after a small delay so it doesn't appear immediately on load
      const timer = setTimeout(() => requestNotificationPermission(), 5000)
      return () => clearTimeout(timer)
    }
  }, [])

  return null
}
