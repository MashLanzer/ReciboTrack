"use client"

import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function UpdateBanner() {
  const [showUpdate, setShowUpdate] = useState(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    // Escucha cuando el SW nuevo está esperando para activarse
    const handleUpdate = () => setShowUpdate(true)

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return

      // Ya hay uno esperando (caso donde recargaron antes de ver el banner)
      if (reg.waiting) {
        setShowUpdate(true)
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing
        newWorker?.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setShowUpdate(true)
          }
        })
      })
    })

    navigator.serviceWorker.addEventListener("controllerchange", handleUpdate)
    return () => navigator.serviceWorker.removeEventListener("controllerchange", handleUpdate)
  }, [])

  if (!showUpdate) return null

  function applyUpdate() {
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.waiting?.postMessage({ type: "SKIP_WAITING" })
      window.location.reload()
    })
  }

  return (
    <div className="fixed top-14 md:top-14 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl border bg-card/95 backdrop-blur shadow-lg px-4 py-3 text-sm max-w-sm w-full">
        <RefreshCw className="h-4 w-4 shrink-0 text-muted-foreground animate-spin" style={{ animationDuration: "3s" }} />
        <p className="flex-1 text-xs">Nueva versión disponible</p>
        <Button size="sm" className="h-7 text-xs shrink-0" onClick={applyUpdate}>
          Actualizar
        </Button>
      </div>
    </div>
  )
}
