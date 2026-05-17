"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useAuth } from "./use-auth"

const PASSKEY_CRED_KEY  = "rbt_passkey_cred"
const PASSKEY_EMAIL_KEY = "rbt_passkey_email"

/** Returns true if the browser supports WebAuthn / PublicKeyCredential */
export function usePasskeySupport(): boolean {
  if (typeof window === "undefined") return false
  return !!(window.navigator?.credentials && window.PublicKeyCredential)
}

/** Registers a passkey for the current user */
export function useRegisterPasskey() {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  async function register() {
    if (!user || !window.navigator?.credentials) throw new Error("No soportado")
    setIsLoading(true)
    try {
      const challenge = new Uint8Array(32)
      crypto.getRandomValues(challenge)

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "ReciboTrack", id: window.location.hostname },
          user: {
            id: new TextEncoder().encode(user.uid),
            name: user.email ?? user.uid,
            displayName: user.displayName ?? user.email ?? "Usuario",
          },
          pubKeyCredParams: [
            { alg: -7,   type: "public-key" },  // ES256
            { alg: -257, type: "public-key" },  // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60000,
        },
      }) as PublicKeyCredential | null

      if (!credential) throw new Error("No se creó la credencial")

      // Store credential id and user email for future logins
      localStorage.setItem(PASSKEY_CRED_KEY, credential.id)
      localStorage.setItem(PASSKEY_EMAIL_KEY, user.email ?? "")
    } finally {
      setIsLoading(false)
    }
  }

  return { register, isLoading }
}

/** Attempts a passkey login via WebAuthn */
export function usePasskeyLogin() {
  const isSupported = usePasskeySupport()
  const hasPasskey  = typeof window !== "undefined" && !!localStorage.getItem(PASSKEY_CRED_KEY)

  const mutation = useMutation({
    mutationFn: async (): Promise<boolean> => {
      if (!isSupported) return false
      const credId = localStorage.getItem(PASSKEY_CRED_KEY)
      if (!credId) return false

      const challenge = new Uint8Array(32)
      crypto.getRandomValues(challenge)

      try {
        const credential = await navigator.credentials.get({
          publicKey: {
            challenge,
            rpId: window.location.hostname,
            userVerification: "required",
            allowCredentials: [{
              id: Uint8Array.from(atob(credId.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
              type: "public-key",
            }],
            timeout: 60000,
          },
        }) as PublicKeyCredential | null

        return !!credential
      } catch {
        return false
      }
    },
  })

  return {
    login: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isSupported,
    hasPasskey,
  }
}

/** Removes the stored passkey credential */
export function clearPasskey() {
  localStorage.removeItem(PASSKEY_CRED_KEY)
  localStorage.removeItem(PASSKEY_EMAIL_KEY)
}

export function getPasskeyEmail(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(PASSKEY_EMAIL_KEY)
}
