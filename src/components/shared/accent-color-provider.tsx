"use client"

import { useEffect } from "react"
import { useUserSettings } from "@/hooks/use-user-settings"

/**
 * Injects a CSS override for --primary based on the user's saved accentColor (HSL hue).
 * Must be rendered inside AuthGuard so user settings are available.
 */
export function AccentColorProvider() {
  const { data: settings } = useUserSettings()
  const hue = settings?.accentColor ?? "262"

  useEffect(() => {
    const root = document.documentElement
    // Light mode: primary at 30% lightness, foreground white
    root.style.setProperty("--primary", `${hue} 83% 52%`)
    root.style.setProperty("--primary-foreground", "0 0% 100%")
    // Ring matches primary
    root.style.setProperty("--ring", `${hue} 83% 52%`)
    return () => {
      root.style.removeProperty("--primary")
      root.style.removeProperty("--primary-foreground")
      root.style.removeProperty("--ring")
    }
  }, [hue])

  return null
}
