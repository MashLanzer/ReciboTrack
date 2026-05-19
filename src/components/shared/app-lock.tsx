"use client"

/**
 * AppLock — pantalla de bloqueo biométrico al abrir la app
 *
 * - Si el usuario tiene biometría activada (localStorage flag), muestra una
 *   pantalla de bloqueo sobre toda la app y lanza el prompt biométrico auto.
 * - Usa sessionStorage para recordar que ya se desbloqueó en esta sesión del
 *   navegador, así no pide la huella en cada navegación entre páginas.
 * - Re-bloquea si la app estuvo en segundo plano más de LOCK_AFTER_BG_MS ms
 *   (via Page Visibility API — funciona tanto en web como en WebView Capacitor).
 */

import { useState, useEffect, useCallback, useRef } from "react"
import { Fingerprint, Smartphone, Lock } from "lucide-react"
import { hasStoredPasskey, verifyPasskey } from "@/hooks/use-passkey"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

// Vuelve a bloquear si la app estuvo en 2º plano más de este tiempo (ms)
const LOCK_AFTER_BG_MS = 30_000 // 30 segundos

const SESSION_KEY = "rbt_app_unlocked"

function isNativeApp(): boolean {
  if (typeof window === "undefined") return false
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return cap?.isNativePlatform?.() ?? false
}

// ─────────────────────────────────────────────────────────────────────────────

export function AppLock({ children }: { children: React.ReactNode }) {
  // null = todavía comprobando, true = bloqueado, false = desbloqueado
  const [locked, setLocked]     = useState<boolean | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [native, setNative]     = useState(false)
  const bgAtRef = useRef<number | null>(null)

  // ── Desbloquear ────────────────────────────────────────────────────────────
  const unlock = useCallback(() => {
    try { sessionStorage.setItem(SESSION_KEY, "1") } catch { /* Safari privado */ }
    setLocked(false)
  }, [])

  // ── Verificar biometría ────────────────────────────────────────────────────
  const tryVerify = useCallback(async () => {
    if (verifying) return
    setVerifying(true)
    try {
      const result = await verifyPasskey()
      if (result.ok) {
        unlock()
      } else {
        // No mostrar toast si el usuario canceló manualmente
        if (result.error && !result.error.toLowerCase().includes("cancel")) {
          toast.error(result.error)
        }
      }
    } finally {
      setVerifying(false)
    }
  }, [verifying, unlock])

  // ── Comprobación inicial ───────────────────────────────────────────────────
  useEffect(() => {
    setNative(isNativeApp())

    if (!hasStoredPasskey()) {
      // No hay biometría registrada → dejar pasar sin bloquear
      setLocked(false)
      return
    }

    // Ya desbloqueado en esta sesión del navegador
    try {
      if (sessionStorage.getItem(SESSION_KEY)) {
        setLocked(false)
        return
      }
    } catch { /* Safari privado */ }

    // Necesita desbloqueo → mostrar pantalla de bloqueo
    setLocked(true)
  }, [])

  // ── Auto-lanzar el prompt biométrico cuando aparece la pantalla de bloqueo ──
  useEffect(() => {
    if (locked !== true) return
    // Pequeño delay para que la pantalla se renderice primero
    const t = setTimeout(() => tryVerify(), 400)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked])

  // ── Re-bloquear si la app vuelve del fondo ────────────────────────────────
  useEffect(() => {
    if (typeof document === "undefined") return

    const handler = () => {
      if (document.hidden) {
        // App va a segundo plano — anotar momento
        bgAtRef.current = Date.now()
      } else {
        // App vuelve a primer plano
        if (bgAtRef.current !== null) {
          const elapsed = Date.now() - bgAtRef.current
          bgAtRef.current = null
          if (elapsed > LOCK_AFTER_BG_MS && hasStoredPasskey()) {
            try { sessionStorage.removeItem(SESSION_KEY) } catch { /* noop */ }
            setLocked(true)
          }
        }
      }
    }

    document.addEventListener("visibilitychange", handler)
    return () => document.removeEventListener("visibilitychange", handler)
  }, [])

  // ── Todavía comprobando → pantalla vacía mínima para evitar flash ─────────
  if (locked === null) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Lock className="h-6 w-6 text-muted-foreground/30 animate-pulse" />
      </div>
    )
  }

  // ── Desbloqueado → mostrar la app normalmente ─────────────────────────────
  if (!locked) return <>{children}</>

  // ── Pantalla de bloqueo ───────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background gap-8 p-8 animate-[fadeIn_0.25s_ease_both]">
      {/* Icono principal */}
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="relative">
          {/* Anillo decorativo externo */}
          <div className="absolute inset-0 rounded-full border-2 border-foreground/5 scale-[1.6]" />
          <div className="absolute inset-0 rounded-full border border-foreground/5 scale-[1.35]" />
          <div className="h-24 w-24 rounded-3xl bg-foreground/5 border border-border flex items-center justify-center">
            {native
              ? <Smartphone className="h-12 w-12 text-muted-foreground" />
              : <Fingerprint className="h-12 w-12 text-muted-foreground" />}
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="font-serif text-2xl tracking-tight">ReciboTrack</h1>
          <p className="text-sm text-muted-foreground">
            {native
              ? "Usa tu huella o bloqueo de pantalla para entrar"
              : "Usa tu huella o Face ID para desbloquear"}
          </p>
        </div>
      </div>

      {/* Botón principal */}
      <Button
        size="lg"
        variant="outline"
        className="gap-2.5 min-w-44 rounded-2xl h-12 text-base font-medium"
        onClick={tryVerify}
        disabled={verifying}
      >
        {verifying ? (
          <span className="h-4 w-4 rounded-full border-2 border-foreground border-t-transparent animate-spin" />
        ) : native ? (
          <Smartphone className="h-4 w-4" />
        ) : (
          <Fingerprint className="h-4 w-4" />
        )}
        {verifying ? "Verificando…" : "Desbloquear"}
      </Button>

      {/* Fallback a contraseña */}
      <button
        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
        onClick={() => {
          try { sessionStorage.removeItem(SESSION_KEY) } catch { /* noop */ }
          window.location.href = "/login"
        }}
      >
        Usar contraseña en su lugar
      </button>
    </div>
  )
}
