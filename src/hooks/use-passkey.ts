"use client"

/**
 * Passkey / Biometric authentication hook
 *
 * Two completely independent code paths:
 *
 * ── NATIVE (Capacitor APK on Android/iOS) ──────────────────────────────────
 *   Uses @aparajita/capacitor-biometric-auth which calls Android BiometricPrompt
 *   / iOS LocalAuthentication natively. WebAuthn is NOT used (unsupported in
 *   Android WebView).
 *
 *   Registration = saving a localStorage flag (the biometric IS the device lock).
 *   Verification = native biometric prompt → if ok, check Firebase session.
 *
 * ── WEB (PWA / desktop browser) ────────────────────────────────────────────
 *   Uses the WebAuthn PublicKeyCredential API (navigator.credentials).
 *   Credential ID stored as hex in localStorage (v2 key, avoids base64 padding).
 */

import { useState, useEffect } from "react"
import { getFirebaseAuth } from "@/lib/firebase/client"
import type { User } from "firebase/auth"

// ── Storage keys ─────────────────────────────────────────────────────────────

const PASSKEY_CRED_KEY   = "rbt_passkey_cred_v2"   // web: hex credential ID
const PASSKEY_EMAIL_KEY  = "rbt_passkey_email"
const NATIVE_BIO_KEY     = "rbt_native_bio_reg"     // native: "1" when enabled

// ── Native Capacitor detection ────────────────────────────────────────────────

function isNativeApp(): boolean {
  if (typeof window === "undefined") return false
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return cap?.isNativePlatform?.() ?? false
}

// ── Encoding helpers (web path only) ─────────────────────────────────────────

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function hexToBuf(hex: string): Uint8Array<ArrayBuffer> {
  const buf   = new ArrayBuffer(hex.length / 2)
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

// ── Firebase session helper ───────────────────────────────────────────────────

async function waitForFirebaseUser(
  auth: ReturnType<typeof getFirebaseAuth>,
  timeoutMs: number,
): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser
  return new Promise((resolve) => {
    const timer = setTimeout(() => { unsub(); resolve(auth.currentUser) }, timeoutMs)
    const unsub = auth.onAuthStateChanged((user) => { clearTimeout(timer); unsub(); resolve(user) })
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORT DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when biometric auth is available on this device.
 *
 * Native APK:  uses @aparajita/capacitor-biometric-auth checkBiometry()
 * Web browser: uses WebAuthn isUserVerifyingPlatformAuthenticatorAvailable()
 */
export function usePasskeySupport(): boolean {
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    if (isNativeApp()) {
      // ── Native path ──────────────────────────────────────────────────────
      // Dynamically import the plugin so the web bundle doesn't break if the
      // native plugin bridge isn't registered (old APK without the plugin).
      import("@aparajita/capacitor-biometric-auth")
        .then(({ BiometricAuth }) => BiometricAuth.checkBiometry())
        .then((result) => setSupported(result.isAvailable || result.deviceIsSecure))
        .catch(() => {
          // Plugin not available in this APK build — fall back to always-supported
          // so the user at least sees the button and gets a clear error on tap.
          setSupported(true)
        })
      return
    }

    // ── Web path ─────────────────────────────────────────────────────────────
    if (!window.PublicKeyCredential) return
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
      setSupported(true)
      return
    }
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      .then((ok) => setSupported(ok))
      .catch(() => setSupported(false))
  }, [])

  return supported
}

/** Returns true if a passkey/biometric has been registered on this device */
export function useHasPasskey(): boolean {
  const [has, setHas] = useState(false)
  useEffect(() => {
    setHas(hasStoredPasskey())
  }, [])
  return has
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registers biometric authentication for this device.
 *
 * Native APK:  verifies biometry once, then saves a flag.
 * Web browser: creates a WebAuthn platform credential.
 */
export function useRegisterPasskey() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function register() {
    setIsLoading(true)
    setError(null)

    try {
      if (isNativeApp()) {
        await registerNative()
      } else {
        await registerWeb()
      }
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al registrar"
      setError(msg)
      throw new Error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return { register, isLoading, error }
}

// ── Native registration ───────────────────────────────────────────────────────

async function registerNative(): Promise<void> {
  const auth = getFirebaseAuth()
  if (!auth.currentUser) throw new Error("Debes estar autenticado para activar el acceso biométrico")

  const { BiometricAuth, BiometryErrorType } = await import("@aparajita/capacitor-biometric-auth")

  try {
    // Prompt once to confirm biometrics work before saving the flag
    await BiometricAuth.authenticate({
      reason:               "Confirma tu huella para activar el acceso rápido",
      cancelTitle:          "Cancelar",
      allowDeviceCredential: true,
      androidTitle:         "Activar acceso biométrico",
      androidSubtitle:      "Toca el sensor de huella o usa tu bloqueo de pantalla",
    })
  } catch (err: unknown) {
    throw new Error(getBiometricErrorMessage(err))
  }

  // Biometry confirmed — save registration flag
  localStorage.setItem(NATIVE_BIO_KEY, "1")
  localStorage.setItem(PASSKEY_EMAIL_KEY, auth.currentUser.email ?? "")
}

// ── Web registration ──────────────────────────────────────────────────────────

async function registerWeb(): Promise<void> {
  const auth = getFirebaseAuth()
  const user = auth.currentUser
  if (!user) throw new Error("Debes estar autenticado para activar el acceso biométrico")
  if (!window.PublicKeyCredential) throw new Error("Tu navegador no soporta passkeys")

  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: "ReciboTrack",
        id:   window.location.hostname,
      },
      user: {
        id:          new TextEncoder().encode(user.uid),
        name:        user.email ?? user.uid,
        displayName: user.displayName ?? user.email ?? "Usuario",
      },
      pubKeyCredParams: [
        { alg: -7,   type: "public-key" },   // ES256
        { alg: -257, type: "public-key" },   // RS256
        { alg: -8,   type: "public-key" },   // EdDSA
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification:        "required",
        residentKey:             "preferred",
      },
      timeout:     60_000,
      attestation: "none",
    },
  }) as PublicKeyCredential | null

  if (!credential) throw new Error("El registro fue cancelado")

  localStorage.setItem(PASSKEY_CRED_KEY, bufToHex(credential.rawId))
  localStorage.setItem(PASSKEY_EMAIL_KEY, user.email ?? "")
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies biometric auth.
 * On success, returns the current Firebase user if the session is still valid.
 */
export async function verifyPasskey(): Promise<{
  ok: boolean
  firebaseUser: User | null
  error?: string
}> {
  try {
    if (isNativeApp()) {
      return await verifyNative()
    }
    return await verifyWeb()
  } catch (err: unknown) {
    return { ok: false, firebaseUser: null, error: err instanceof Error ? err.message : "Error desconocido" }
  }
}

// ── Native verification ───────────────────────────────────────────────────────

async function verifyNative(): Promise<{ ok: boolean; firebaseUser: User | null; error?: string }> {
  if (!localStorage.getItem(NATIVE_BIO_KEY)) {
    return { ok: false, firebaseUser: null, error: "No hay acceso biométrico configurado en este dispositivo" }
  }

  try {
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth")

    await BiometricAuth.authenticate({
      reason:                "Verifica tu identidad para entrar",
      cancelTitle:           "Cancelar",
      allowDeviceCredential: true,
      androidTitle:          "ReciboTrack",
      androidSubtitle:       "Usa tu huella dactilar o bloqueo de pantalla",
    })
  } catch (err: unknown) {
    return { ok: false, firebaseUser: null, error: getBiometricErrorMessage(err) }
  }

  // Biometry passed — check Firebase session
  const auth         = getFirebaseAuth()
  const firebaseUser = await waitForFirebaseUser(auth, 3000)
  return { ok: true, firebaseUser }
}

// ── Web verification ──────────────────────────────────────────────────────────

async function verifyWeb(): Promise<{ ok: boolean; firebaseUser: User | null; error?: string }> {
  const hexId = localStorage.getItem(PASSKEY_CRED_KEY)
  if (!hexId) {
    return { ok: false, firebaseUser: null, error: "No hay passkey registrada en este dispositivo" }
  }
  if (!window.PublicKeyCredential) {
    return { ok: false, firebaseUser: null, error: "Tu navegador no soporta passkeys" }
  }

  try {
    const challenge  = new Uint8Array(32)
    crypto.getRandomValues(challenge)
    const credBytes  = hexToBuf(hexId)

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId:              window.location.hostname,
        userVerification:  "required",
        allowCredentials:  [{ id: credBytes, type: "public-key" }],
        timeout:           60_000,
      },
    }) as PublicKeyCredential | null

    if (!assertion) return { ok: false, firebaseUser: null, error: "La verificación fue cancelada" }

    const auth         = getFirebaseAuth()
    const firebaseUser = await waitForFirebaseUser(auth, 3000)
    return { ok: true, firebaseUser }
  } catch (err: unknown) {
    return { ok: false, firebaseUser: null, error: getWebAuthnErrorMessage(err) }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK WRAPPERS
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Removes all stored passkey/biometric data */
export function clearPasskey() {
  localStorage.removeItem(PASSKEY_CRED_KEY)
  localStorage.removeItem(PASSKEY_EMAIL_KEY)
  localStorage.removeItem(NATIVE_BIO_KEY)
  // Also clear old v1 key if present
  localStorage.removeItem("rbt_passkey_cred")
}

export function getPasskeyEmail(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(PASSKEY_EMAIL_KEY)
}

/** Returns true if ANY biometric/passkey is stored (web or native) */
export function hasStoredPasskey(): boolean {
  if (typeof window === "undefined") return false
  return !!(
    localStorage.getItem(NATIVE_BIO_KEY) ||
    localStorage.getItem(PASSKEY_CRED_KEY) ||
    localStorage.getItem("rbt_passkey_cred")
  )
}

/**
 * Migrates v1 web credential (base64url) to v2 (hex).
 * Native credentials don't need migration.
 */
export function migratePasskeyV1ToV2() {
  if (typeof window === "undefined") return
  const v1 = localStorage.getItem("rbt_passkey_cred")
  if (!v1 || localStorage.getItem(PASSKEY_CRED_KEY)) return
  try {
    const b64    = v1.replace(/-/g, "+").replace(/_/g, "/")
    const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, "=")
    const bytes  = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
    localStorage.setItem(PASSKEY_CRED_KEY, bufToHex(bytes.buffer))
    localStorage.removeItem("rbt_passkey_cred")
  } catch {
    localStorage.removeItem("rbt_passkey_cred")
  }
}

// ── Error message helpers ─────────────────────────────────────────────────────

/** Maps @aparajita/capacitor-biometric-auth errors to Spanish messages */
function getBiometricErrorMessage(err: unknown): string {
  if (!err) return "Error desconocido"
  const code = (err as { code?: string }).code ?? ""

  const MAP: Record<string, string> = {
    userCancel:           "Cancelado por el usuario.",
    appCancel:            "Operación interrumpida.",
    systemCancel:         "Cancelado por el sistema.",
    authenticationFailed: "Biometría no reconocida. Inténtalo de nuevo.",
    biometryLockout:      "Demasiados intentos fallidos. Desbloquea el dispositivo con tu PIN e inténtalo de nuevo.",
    biometryNotAvailable: "La biometría no está disponible. Asegúrate de haberla configurado en Ajustes.",
    biometryNotEnrolled:  "No tienes ninguna huella o cara registrada. Ve a Ajustes → Seguridad para añadirla.",
    passcodeNotSet:       "El dispositivo no tiene bloqueo de pantalla configurado.",
    noDeviceCredential:   "No hay credencial de dispositivo disponible.",
  }

  return MAP[code] ?? (err instanceof Error ? err.message : "Error de autenticación biométrica")
}

/** Maps WebAuthn / DOMException errors to Spanish messages */
function getWebAuthnErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Error desconocido"
  const name = (err as { name?: string }).name ?? ""
  const msg  = err.message.toLowerCase()

  if (name === "NotAllowedError"  || msg.includes("not allowed"))    return "La verificación fue cancelada o denegada. Inténtalo de nuevo."
  if (name === "SecurityError"    || msg.includes("security"))       return "Error de seguridad. Asegúrate de acceder desde la URL correcta (HTTPS)."
  if (name === "NotSupportedError"|| msg.includes("not supported"))  return "Tu dispositivo no admite este tipo de autenticación biométrica."
  if (name === "InvalidStateError"|| msg.includes("already"))        return "Ya tienes una passkey registrada en este dispositivo."
  if (name === "AbortError"       || msg.includes("abort"))          return "La operación fue interrumpida. Inténtalo de nuevo."
  if (name === "ConstraintError")                                     return "El dispositivo no cumple los requisitos de seguridad necesarios."
  if (msg.includes("timeout"))                                       return "Tiempo agotado. Inténtalo de nuevo."

  return err.message || "No se pudo completar la autenticación biométrica"
}
