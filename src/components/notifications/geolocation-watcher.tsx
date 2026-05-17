"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { MapPin, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface GeoWatcherProps {
  /** Optional: show a floating pill with current coordinates */
  showPill?: boolean
  /** Optional: radius in meters to consider "at location" */
  radius?: number
  /** Optional: target location to watch proximity for */
  targetLocation?: { lat: number; lng: number; label: string }
  /** Called when user is within radius of targetLocation */
  onNearby?: (coords: GeolocationCoordinates) => void
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // meters
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const dphi = ((lat2 - lat1) * Math.PI) / 180
  const dlambda = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dphi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function GeolocationWatcher({
  showPill = false,
  radius = 200,
  targetLocation,
  onNearby,
}: GeoWatcherProps) {
  const watchId = useRef<number | null>(null)
  const notifiedNearby = useRef(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!("geolocation" in navigator)) return

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setCoords({ lat: latitude, lng: longitude, accuracy })

        if (targetLocation && onNearby) {
          const dist = haversineDistance(
            latitude,
            longitude,
            targetLocation.lat,
            targetLocation.lng
          )
          if (dist <= radius && !notifiedNearby.current) {
            notifiedNearby.current = true
            onNearby(pos.coords)
            toast.info(`📍 Cerca de ${targetLocation.label}`, {
              description: `Estás a ${Math.round(dist)} m del lugar`,
            })
          } else if (dist > radius * 2) {
            // Reset so we can notify again when returning
            notifiedNearby.current = false
          }
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          // Silently ignore — user denied permission
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30_000,
        timeout: 15_000,
      }
    )

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current)
      }
    }
  }, [targetLocation, radius, onNearby])

  if (!showPill || !coords || dismissed) return null

  return (
    <div className={cn(
      "fixed bottom-20 left-1/2 -translate-x-1/2 z-40",
      "flex items-center gap-2 rounded-full border bg-card shadow-lg px-3 py-1.5",
      "text-xs font-mono text-muted-foreground"
    )}>
      <MapPin className="h-3 w-3 text-primary shrink-0" />
      <span>
        {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
      </span>
      <span className="text-[10px] opacity-60">±{Math.round(coords.accuracy)}m</span>
      <button
        onClick={() => setDismissed(true)}
        className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

/**
 * Minimal version — just watches and calls onNearby, no UI.
 * Drop this anywhere in the component tree to enable proximity detection.
 */
export function GeolocationProximityWatcher({
  targetLocation,
  radius = 200,
  onNearby,
}: {
  targetLocation: { lat: number; lng: number; label: string }
  radius?: number
  onNearby: (coords: GeolocationCoordinates) => void
}) {
  return (
    <GeolocationWatcher
      targetLocation={targetLocation}
      radius={radius}
      onNearby={onNearby}
      showPill={false}
    />
  )
}
