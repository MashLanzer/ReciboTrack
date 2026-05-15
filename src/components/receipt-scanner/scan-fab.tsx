"use client"

import { useUIStore } from "@/stores/ui-store"
import { Button } from "@/components/ui/button"
import { ScanLine } from "lucide-react"

export function ScanFab() {
  const { setScannerOpen } = useUIStore()
  return (
    <Button
      onClick={() => setScannerOpen(true)}
      className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg md:bottom-6 md:right-6 z-30"
      size="icon"
      aria-label="Escanear recibo"
    >
      <ScanLine className="h-6 w-6" />
    </Button>
  )
}
