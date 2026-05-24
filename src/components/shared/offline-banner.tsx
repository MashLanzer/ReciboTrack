"use client"

import { useState, useEffect, useRef } from "react"
import { WifiOff, Wifi } from "lucide-react"
import { cn } from "@/lib/utils"

type State = "online" | "offline" | "reconnected"

export function OfflineBanner() {
  const [state, setState] = useState<State>("online")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!navigator.onLine) setState("offline")

    const handleOffline = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      setState("offline")
    }

    const handleOnline = () => {
      // Only show the "reconnected" flash if we were offline
      setState((prev) => {
        if (prev === "offline") {
          timerRef.current = setTimeout(() => setState("online"), 2500)
          return "reconnected"
        }
        return "online"
      })
    }

    window.addEventListener("offline", handleOffline)
    window.addEventListener("online",  handleOnline)
    return () => {
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("online",  handleOnline)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const visible = state !== "online"

  return (
    <div
      aria-live="polite"
      role="status"
      className={cn(
        "fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 py-2.5",
        "text-white text-xs font-semibold tracking-wide",
        "transition-all duration-300 ease-out",
        visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0",
        state === "offline"     && "bg-warning",
        state === "reconnected" && "bg-emerald-500",
      )}
    >
      {state === "reconnected" ? (
        <>
          <Wifi className="h-3.5 w-3.5 animate-[fadeSlideUp_0.3s_ease-out_both]" />
          Conexión restaurada
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          Sin conexión — los cambios se sincronizarán al reconectar
        </>
      )}
    </div>
  )
}
