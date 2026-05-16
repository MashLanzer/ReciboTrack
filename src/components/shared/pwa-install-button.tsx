"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download, Smartphone } from "lucide-react"

export function PwaInstallButton() {
  const [prompt, setPrompt] = useState<Event & { prompt?: () => Promise<void> } | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setPrompt(e as any) }
    window.addEventListener("beforeinstallprompt", handler)
    window.addEventListener("appinstalled", () => setInstalled(true))
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  if (installed) return (
    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
      <Smartphone className="h-4 w-4" /> App instalada correctamente
    </div>
  )

  if (!prompt) return null

  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={() => (prompt as any).prompt?.()}>
      <Download className="h-4 w-4" />
      Instalar app en este dispositivo
    </Button>
  )
}
