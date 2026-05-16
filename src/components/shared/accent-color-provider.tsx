"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"
import { useUserSettings } from "@/hooks/use-user-settings"

/**
 * Injects a CSS override for --primary based on the user's saved accentColor (HSL hue).
 * Also handles auto-theme switching by time of day when autoTheme is enabled.
 * Must be rendered inside AuthGuard so user settings are available.
 */
export function AccentColorProvider() {
  const { data: settings } = useUserSettings()
  const hue = settings?.accentColor ?? "262"
  const { setTheme } = useTheme()

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

  useEffect(() => {
    if (!settings?.autoTheme) return
    const apply = () => {
      const h = new Date().getHours()
      setTheme(h >= 21 || h < 7 ? "dark" : "light")
    }
    apply()
    const id = setInterval(apply, 60_000)
    return () => clearInterval(id)
  }, [settings?.autoTheme, setTheme])

  return null
}
