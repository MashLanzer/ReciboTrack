/**
 * Shared portal token utilities.
 * Tokens are base64url-encoded JSON blobs (client-side only, no server secrets).
 * Structure: { uid, name, period, generatedAt }
 */

export interface ShareTokenPayload {
  uid: string
  name: string
  /** "YYYY-MM" */
  period: string
  generatedAt: string // ISO
}

export function encodeShareToken(payload: ShareTokenPayload): string {
  const json = JSON.stringify(payload)
  if (typeof btoa !== "undefined") {
    return btoa(encodeURIComponent(json))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
  }
  return Buffer.from(json, "utf-8").toString("base64url")
}

export function decodeShareToken(token: string): ShareTokenPayload | null {
  try {
    // Restore padding
    const padded = token.replace(/-/g, "+").replace(/_/g, "/")
    const padLen = (4 - (padded.length % 4)) % 4
    const base64 = padded + "=".repeat(padLen)
    const json =
      typeof atob !== "undefined"
        ? decodeURIComponent(atob(base64))
        : Buffer.from(base64, "base64").toString("utf-8")
    return JSON.parse(json) as ShareTokenPayload
  } catch {
    return null
  }
}

export function buildShareUrl(payload: ShareTokenPayload): string {
  const token = encodeShareToken(payload)
  const base =
    typeof window !== "undefined" ? window.location.origin : ""
  return `${base}/share/${token}`
}
