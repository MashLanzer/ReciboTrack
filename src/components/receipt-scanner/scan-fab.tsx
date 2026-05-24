"use client"

import { useUIStore } from "@/stores/ui-store"
import { ScanLine } from "lucide-react"

export function ScanFab() {
  const { setScannerOpen } = useUIStore()
  return (
    <button
      onClick={() => setScannerOpen(true)}
      aria-label="Escanear recibo"
      className="fixed right-4 z-30 md:right-6 h-14 w-14 rounded-full
        bg-primary text-primary-foreground
        shadow-[0_8px_28px_-4px_hsl(var(--primary)/0.55)]
        flex items-center justify-center
        active:scale-[0.88] active:shadow-none active:transition-none
        transition-transform duration-200 ease-out
        md:bottom-6"
      style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <ScanLine className="h-6 w-6" />
    </button>
  )
}
