"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Camera, FlipHorizontal, X, AlertCircle } from "lucide-react"

interface CameraCaptureProps {
  onCapture: (file: File) => void
  onCancel: () => void
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const startCamera = useCallback(async (mode: "environment" | "user") => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    setReady(false)
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      setError("No se pudo acceder a la cámara. Verifica los permisos del navegador.")
    }
  }, [])

  useEffect(() => {
    startCamera(facingMode)
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()) }
  }, [facingMode, startCamera])

  function capture() {
    const video = videoRef.current
    if (!video || !ready) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext("2d")?.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      streamRef.current?.getTracks().forEach((t) => t.stop())
      onCapture(new File([blob], `receipt-${Date.now()}.jpg`, { type: "image/jpeg" }))
    }, "image/jpeg", 0.92)
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "3/4", maxHeight: "52vh" }}>
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground p-6 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onCanPlay={() => setReady(true)}
            className="w-full h-full object-cover"
          />
        )}
        {/* Guías de encuadre */}
        {!error && (
          <div className="absolute inset-6 pointer-events-none">
            {[["top-0 left-0 border-t-2 border-l-2 rounded-tl-lg", ""],
              ["top-0 right-0 border-t-2 border-r-2 rounded-tr-lg", ""],
              ["bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg", ""],
              ["bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg", ""],
            ].map(([cls], i) => (
              <div key={i} className={`absolute w-8 h-8 border-white/80 ${cls}`} />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={onCancel} className="shrink-0">
          <X className="h-4 w-4" />
        </Button>
        <Button className="flex-1 h-12" onClick={capture} disabled={!ready || !!error}>
          <Camera className="h-5 w-5 mr-2" />
          Capturar
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="shrink-0"
          disabled={!!error}
          onClick={() => setFacingMode((f) => (f === "environment" ? "user" : "environment"))}
        >
          <FlipHorizontal className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-center text-muted-foreground">Encuadra el recibo en la pantalla</p>
    </div>
  )
}
