/**
 * Geocoding utilities using Nominatim (OpenStreetMap) — no API key required.
 * Rate-limited to 1 request/second per OSM policy.
 */

export interface GeoCoords {
  lat: number
  lng: number
  accuracy?: number
}

export interface ReverseGeoResult {
  cityName: string | null
  countryCode: string | null
  countryName: string | null
  displayName: string | null
}

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org"

/** Reverse-geocode a lat/lng to city + country */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeoResult> {
  try {
    const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`
    const res  = await fetch(url, {
      headers: { "User-Agent": "ReciboTrack/1.0 (contact@recibotrack.app)" },
    })
    if (!res.ok) return { cityName: null, countryCode: null, countryName: null, displayName: null }

    const data = await res.json() as {
      address?: {
        city?: string; town?: string; village?: string; municipality?: string
        country_code?: string; country?: string
      }
      display_name?: string
    }

    const addr = data.address ?? {}
    const cityName = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? null

    return {
      cityName,
      countryCode: addr.country_code?.toUpperCase() ?? null,
      countryName: addr.country ?? null,
      displayName: data.display_name ?? null,
    }
  } catch {
    return { cityName: null, countryCode: null, countryName: null, displayName: null }
  }
}

export type GeoError = "denied" | "unavailable" | "timeout" | "unsupported"

export interface GeoResult {
  coords: GeoCoords | null
  error: GeoError | null
}

/** Request geolocation from the browser — always resolves, never rejects.
 *  Returns { coords, error } so callers can show specific error messages. */
export function requestGeolocation(): Promise<GeoResult> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ coords: null, error: "unsupported" })
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        coords: {
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        },
        error: null,
      }),
      (err) => {
        const error: GeoError =
          err.code === 1 ? "denied" :
          err.code === 3 ? "timeout" :
          "unavailable"
        resolve({ coords: null, error })
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  })
}

/** Calculate Haversine distance between two points in meters */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R  = 6_371_000
  const φ1 = (a.lat * Math.PI) / 180
  const φ2 = (b.lat * Math.PI) / 180
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180
  const x  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}
