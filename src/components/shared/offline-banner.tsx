"use client"

import { useState, useEffect } from "react"
import { WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"

export function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    // Initialise from current state
    setOffline(!navigator.onLine)

    const handleOffline = () => setOffline(true)
    const handleOnline  = () => setOffline(false)

    window.addEventListener("offline", handleOffline)
    window.addEventListener("online",  handleOnline)
    return () => {
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("online",  handleOnline)
    }
  }, [])

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 py-2",
        "bg-amber-500 text-white text-xs font-medium",
        "transition-transform duration-300",
        offline ? "translate-y-0" : "-translate-y-full"
      )}
    >
      <WifiOff className="h-3.5 w-3.5" />
      Sin conexión — los cambios se sincronizarán al reconectar
    </div>
  )
}
