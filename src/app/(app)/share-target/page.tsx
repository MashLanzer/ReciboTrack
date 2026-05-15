"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUIStore } from "@/stores/ui-store"
import { Loader2 } from "lucide-react"

/**
 * Web Share Target handler.
 * When the user shares an image from their phone's gallery/camera to ReciboTrack,
 * the browser POSTs the file here as multipart/form-data.
 * We read it from the service worker cache, trigger the scanner, and redirect.
 *
 * The service worker intercepts the POST to /share-target/ and stores the file
 * in a special cache key "share-target-file". This page reads it and opens the scanner.
 */
export default function ShareTargetPage() {
  const router = useRouter()
  const { setScannerOpen, setSharedFile } = useUIStore()

  useEffect(() => {
    async function handleSharedFile() {
      try {
        // The service worker stores the shared file in Cache API under this key
        const cache = await caches.open("share-target")
        const response = await cache.match("shared-file")

        if (response) {
          const blob = await response.blob()
          const file = new File([blob], `shared-receipt-${Date.now()}.jpg`, {
            type: blob.type || "image/jpeg",
          })
          await cache.delete("shared-file")
          setSharedFile(file)
          setScannerOpen(true)
        }
      } catch {
        // If cache API fails, just open scanner normally
        setScannerOpen(true)
      }

      router.replace("/dashboard")
    }

    handleSharedFile()
  }, [router, setScannerOpen, setSharedFile])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Abriendo escáner...</p>
    </div>
  )
}
