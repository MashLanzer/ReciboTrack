"use client"

import { useState, useEffect } from "react"
import { MapPin, Loader2, X, ShieldOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { requestGeolocation, reverseGeocode } from "@/lib/geocoding"
import { toast } from "sonner"

export interface GeoPickerValue {
  lat: number
  lng: number
  accuracy?: number
  cityName: string | null
  countryCode: string | null
}

interface Props {
  value: GeoPickerValue | null
  onChange: (v: GeoPickerValue | null) => void
  /** Show compact inline variant (default: full button) */
  compact?: boolean
}

// Detect platform for OS-specific instructions
function getPermissionHint(): string {
  if (typeof navigator === "undefined") return ""
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) {
    return "Ajustes del iPhone → Privacidad → Localización → Safari → Permitir"
  }
  if (/Android/.test(ua)) {
    return "Toca el candado 🔒 en la barra de dirección → Permisos del sitio → Ubicación → Permitir"
  }
  return "Haz clic en el candado 🔒 en la barra de dirección → Permisos del sitio → Ubicación → Permitir"
}

export function GeoPicker({ value, onChange, compact }: Props) {
  const [loading, setLoading] = useState(false)
  // "denied" = already blocked, show settings link instead of request button
  const [permDenied, setPermDenied] = useState(false)

  // Check permission state on mount (where Permissions API is available)
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return
    navigator.permissions.query({ name: "geolocation" }).then((status) => {
      setPermDenied(status.state === "denied")
      status.addEventListener("change", () => setPermDenied(status.state === "denied"))
    }).catch(() => { /* permissions API not available */ })
  }, [])

  async function capture() {
    setLoading(true)
    try {
      const { coords, error } = await requestGeolocation()

      if (!coords) {
        if (error === "denied") {
          setPermDenied(true)
          toast.error("Permiso de ubicación bloqueado", {
            description: getPermissionHint(),
            duration: 8000,
          })
        } else if (error === "timeout") {
          toast.warning("GPS tardó demasiado", {
            description: "Intenta en un lugar con mejor señal o al aire libre.",
            duration: 5000,
          })
        } else if (error === "unsupported") {
          toast.info("Ubicación no disponible en este navegador", {
            duration: 4000,
          })
        } else {
          toast.warning("No se pudo detectar la ubicación", {
            description: "Verifica que el GPS esté activo en tu dispositivo.",
            duration: 5000,
          })
        }
        return
      }

      // Save coords immediately, reverse-geocode in background
      onChange({
        lat:         coords.lat,
        lng:         coords.lng,
        accuracy:    coords.accuracy,
        cityName:    null,
        countryCode: null,
      })

      const geo = await reverseGeocode(coords.lat, coords.lng).catch(() => ({
        cityName: null, countryCode: null, countryName: null, displayName: null,
      }))
      onChange({
        lat:         coords.lat,
        lng:         coords.lng,
        accuracy:    coords.accuracy,
        cityName:    geo.cityName,
        countryCode: geo.countryCode,
      })
    } catch {
      toast.error("No se pudo obtener la ubicación")
    } finally {
      setLoading(false)
    }
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
  }

  if (compact) {
    // Inline chip variant for forms
    return (
      <div className="flex items-center gap-1.5">
        {value ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-xs font-medium">
            <MapPin className="h-3 w-3" />
            {value.cityName ?? `${value.lat.toFixed(3)}, ${value.lng.toFixed(3)}`}
            <button type="button" onClick={clear} className="ml-0.5 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </span>
        ) : permDenied ? (
          <button
            type="button"
            onClick={() => toast.error("Permiso de ubicación bloqueado", { description: getPermissionHint(), duration: 8000 })}
            className="inline-flex items-center gap-1 rounded-full border border-destructive/40 px-2 py-0.5 text-xs text-destructive/70"
          >
            <ShieldOff className="h-3 w-3" />
            Ubicación bloqueada
          </button>
        ) : (
          <button
            type="button"
            onClick={capture}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
            {loading ? "Detectando…" : "Ubicación"}
          </button>
        )}
      </div>
    )
  }

  // Full button variant
  return (
    <div className="flex items-center gap-2">
      {value ? (
        <>
          <div className="flex-1 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
            <MapPin className="h-4 w-4 text-blue-500 shrink-0" />
            <span className="flex-1 truncate text-muted-foreground">
              {value.cityName
                ? `${value.cityName}${value.countryCode ? ` · ${value.countryCode}` : ""}`
                : `${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`
              }
            </span>
          </div>
          <Button type="button" size="sm" variant="ghost" className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive" onClick={clear}>
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : permDenied ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 text-destructive/70 border-destructive/30"
          onClick={() => toast.error("Permiso de ubicación bloqueado", { description: getPermissionHint(), duration: 8000 })}
        >
          <ShieldOff className="h-4 w-4" />
          Ubicación bloqueada — toca para ver cómo activarla
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 text-muted-foreground"
          onClick={capture}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          {loading ? "Detectando ubicación…" : "Añadir ubicación"}
        </Button>
      )}
    </div>
  )
}
