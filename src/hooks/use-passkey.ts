"use client"

import { useState, useEffect } from "react"
import { getFirebaseAuth } from "@/lib/firebase/client"
import type { User } from "firebase/auth"

// ── Storage keys ─────────────────────────────────────────────────────────────
// v2: credential ID stored as hex (avoids base64url padding issues entirely)
const PASSKEY_CRED_KEY  = "rbt_passkey_cred_v2"
const PASSKEY_EMAIL_KEY = "rbt_passkey_email"

// ── Encoding helpers ──────────────────────────────────────────────────────────

/** ArrayBuffer → hex string (no encoding issues, portable) */
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** hex string → Uint8Array (with an explicit ArrayBuffer so TS is happy with BufferSource) */
function hexToBuf(hex: string): Uint8Array<ArrayBuffer> {
  const buf   = new ArrayBuffer(hex.length / 2)
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

// ── Support detection ─────────────────────────────────────────────────────────

/**
 * Async hook — returns true only when the device has a platform authenticator
 * (fingerprint, Face ID, Windows Hello, etc.) that can verify the user.
 *
 * Uses `isUserVerifyingPlatformAuthenticatorAvailable()` which is the correct
 * API for detecting biometric capability, as opposed to just checking for the
 * `PublicKeyCredential` constructor which exists even on devices with no
 * enrolled biometrics.
 */
export function usePasskeySupport(): boolean {
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!window.PublicKeyCredential) return
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
      // Older browsers that have WebAuthn but not this method — assume supported
      setSupported(true)
      return
    }
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      .then((ok) => setSupported(ok))
      .catch(() => setSupported(false))
  }, [])

  return supported
}

/** Returns true if a passkey credential is stored on this device */
export function useHasPasskey(): boolean {
  const [has, setHas] = useState(false)
  useEffect(() => {
    setHas(!!localStorage.getItem(PASSKEY_CRED_KEY))
  }, [])
  return has
}

// ── Registration ──────────────────────────────────────────────────────────────

/**
 * Registers a platform passkey for the current Firebase user.
 * Stores the credential ID as hex in localStorage.
 */
export function useRegisterPasskey() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function register() {
    const auth = getFirebaseAuth()
    const user = auth.currentUser
    if (!user) throw new Error("Debes estar autenticado para activar el acceso biométrico")
    if (!window.PublicKeyCredential) throw new Error("Tu navegador no soporta passkeys")

    setIsLoading(true)
    setError(null)

    try {
      const challenge = new Uint8Array(32)
      crypto.getRandomValues(challenge)

      // NOTE: On iOS the navigator.credentials.create() call MUST happen
      // synchronously within a user-gesture handler. We keep all async work
      // (setIsLoading is sync, crypto is sync) before the call.
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: "ReciboTrack",
            // rpId must be the hostname only (no port, no protocol)
            id: window.location.hostname,
          },
          user: {
            // rawId must be a stable unique bytes for this user
            id: new TextEncoder().encode(user.uid),
            name: user.email ?? user.uid,
            displayName: user.displayName ?? user.email ?? "Usuario",
          },
          pubKeyCredParams: [
            { alg: -7,   type: "public-key" },  // ES256 (preferred)
            { alg: -257, type: "public-key" },  // RS256 (fallback for Windows Hello)
            { alg: -8,   type: "public-key" },  // EdDSA (future-proofing)
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",  // only device biometrics
            userVerification: "required",          // fingerprint/face required
            residentKey: "preferred",              // better UX on mobile
          },
          timeout: 60_000,
          attestation: "none",  // we don't verify attestation server-side
        },
      }) as PublicKeyCredential | null

      if (!credential) throw new Error("El registro fue cancelado")

      // Store as hex — avoids all base64url padding issues
      const hexId = bufToHex(credential.rawId)
      localStorage.setItem(PASSKEY_CRED_KEY, hexId)
      localStorage.setItem(PASSKEY_EMAIL_KEY, user.email ?? "")

      return true
    } catch (err: unknown) {
      const msg = getWebAuthnErrorMessage(err)
      setError(msg)
      throw new Error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return { register, isLoading, error }
}

// ── Verification ──────────────────────────────────────────────────────────────

/**
 * Verifies a previously-registered passkey via biometrics.
 *
 * On success, returns the current Firebase user if still authenticated
 * (the common case — Firebase sessions persist in IndexedDB). Returns null
 * if the Firebase session has expired (user must re-login with email/Google).
 *
 * This is intentionally a client-only flow. The passkey acts as a "session
 * guardian": it verifies the person has the device and biometric, then allows
 * re-using the existing Firebase session without re-entering a password.
 */
export async function verifyPasskey(): Promise<{ ok: boolean; firebaseUser: User | null; error?: string }> {
  const hexId = localStorage.getItem(PASSKEY_CRED_KEY)
  if (!hexId) return { ok: false, firebaseUser: null, error: "No hay passkey registrada en este dispositivo" }

  if (!window.PublicKeyCredential) {
    return { ok: false, firebaseUser: null, error: "Tu navegador no soporta passkeys" }
  }

  try {
    const challenge = new Uint8Array(32)
    crypto.getRandomValues(challenge)

    const credBytes = hexToBuf(hexId)

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        userVerification: "required",
        allowCredentials: [{ id: credBytes, type: "public-key" }],
        timeout: 60_000,
      },
    }) as PublicKeyCredential | null

    if (!assertion) {
      return { ok: false, firebaseUser: null, error: "La verificación fue cancelada" }
    }

    // WebAuthn verification succeeded — now check Firebase session
    const auth = getFirebaseAuth()

    // Firebase persists auth in IndexedDB. currentUser is loaded synchronously
    // from the in-memory cache after initial hydration.
    const firebaseUser = await waitForFirebaseUser(auth, 3000)

    return { ok: true, firebaseUser }
  } catch (err: unknown) {
    const msg = getWebAuthnErrorMessage(err)
    return { ok: false, firebaseUser: null, error: msg }
  }
}

/** Waits up to `timeoutMs` for Firebase to resolve the current user */
async function waitForFirebaseUser(
  auth: ReturnType<typeof getFirebaseAuth>,
  timeoutMs: number
): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsub()
      resolve(auth.currentUser)
    }, timeoutMs)

    const unsub = auth.onAuthStateChanged((user) => {
      clearTimeout(timer)
      unsub()
      resolve(user)
    })
  })
}

// ── Hook wrappers ─────────────────────────────────────────────────────────────

export function usePasskeyLogin() {
  const isSupported = usePasskeySupport()
  const hasPasskey  = useHasPasskey()
  const [isLoading, setIsLoading] = useState(false)

  async function login() {
    setIsLoading(true)
    try {
      return await verifyPasskey()
    } finally {
      setIsLoading(false)
    }
  }

  return { login, isLoading, isSupported, hasPasskey }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Removes the stored passkey credential */
export function clearPasskey() {
  localStorage.removeItem(PASSKEY_CRED_KEY)
  localStorage.removeItem(PASSKEY_EMAIL_KEY)
  // Also clear the old v1 key if present
  localStorage.removeItem("rbt_passkey_cred")
}

export function getPasskeyEmail(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(PASSKEY_EMAIL_KEY)
}

/** Returns true if ANY passkey credential is stored (checks both v1 and v2) */
export function hasStoredPasskey(): boolean {
  if (typeof window === "undefined") return false
  return !!(localStorage.getItem(PASSKEY_CRED_KEY) || localStorage.getItem("rbt_passkey_cred"))
}

/**
 * Migrates a v1 credential (base64url string) to v2 (hex string).
 * Called once on app mount to transparently upgrade existing users.
 */
export function migratePasskeyV1ToV2() {
  if (typeof window === "undefined") return
  const v1 = localStorage.getItem("rbt_passkey_cred")
  if (!v1 || localStorage.getItem(PASSKEY_CRED_KEY)) return

  try {
    // v1 stored the base64url credential.id — convert to hex
    const b64 = v1.replace(/-/g, "+").replace(/_/g, "/")
    const padded = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, "=")
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
    const hex = bufToHex(bytes.buffer)
    localStorage.setItem(PASSKEY_CRED_KEY, hex)
    localStorage.removeItem("rbt_passkey_cred")
  } catch {
    // If migration fails, remove the broken v1 entry so user re-registers
    localStorage.removeItem("rbt_passkey_cred")
  }
}

/** Converts WebAuthn/DOMException errors to Spanish user-friendly messages */
function getWebAuthnErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Error desconocido"

  const name = (err as { name?: string }).name ?? ""
  const msg  = err.message.toLowerCase()

  // DOMException names from the WebAuthn spec
  if (name === "NotAllowedError" || msg.includes("not allowed")) {
    return "La verificación fue cancelada o denegada. Inténtalo de nuevo."
  }
  if (name === "SecurityError" || msg.includes("security")) {
    return "Error de seguridad. Asegúrate de acceder desde la URL correcta (HTTPS)."
  }
  if (name === "NotSupportedError" || msg.includes("not supported")) {
    return "Tu dispositivo no admite este tipo de autenticación biométrica."
  }
  if (name === "InvalidStateError" || msg.includes("already registered")) {
    return "Ya tienes una passkey registrada en este dispositivo."
  }
  if (name === "AbortError" || msg.includes("abort")) {
    return "La operación fue interrumpida. Inténtalo de nuevo."
  }
  if (name === "ConstraintError") {
    return "El dispositivo no cumple los requisitos de seguridad necesarios."
  }
  if (msg.includes("timeout")) {
    return "Tiempo agotado. Inténtalo de nuevo."
  }

  return err.message || "No se pudo completar la autenticación biométrica"
}
