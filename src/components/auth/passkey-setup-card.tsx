"use client"

import { useEffect, useState } from "react"
import { Fingerprint, Check, Loader2, Smartphone } from "lucide-react"
import { usePasskeySupport, useHasPasskey, useRegisterPasskey, clearPasskey } from "@/hooks/use-passkey"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

/** Detects Capacitor native app — same helper used in the hook */
function isNativeApp(): boolean {
  if (typeof window === "undefined") return false
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return cap?.isNativePlatform?.() ?? false
}

export function PasskeySetupCard() {
  const isSupported = usePasskeySupport()
  const registered  = useHasPasskey()
  const { register, isLoading, error } = useRegisterPasskey()
  const [native, setNative] = useState(false)

  useEffect(() => { setNative(isNativeApp()) }, [])

  async function handleRegister() {
    try {
      await register()
      toast.success("Acceso biométrico activado")
    } catch (err) {
      const msg = error ?? (err instanceof Error ? err.message : "Error al registrar")
      toast.error(msg)
    }
  }

  function handleDeactivate() {
    clearPasskey()
    toast.success("Acceso biométrico desactivado")
  }

  // Determine subtitle based on context + state
  let subtitle: React.ReactNode
  if (registered) {
    subtitle = (
      <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
        <Check className="h-3 w-3" />
        {native ? "Activo — huella / bloqueo de pantalla" : "Activo — huella / Face ID"}
      </p>
    )
  } else if (!isSupported) {
    subtitle = (
      <p className="text-xs text-muted-foreground">
        {native
          ? "Configura la huella dactilar en Ajustes del dispositivo"
          : "Tu dispositivo no soporta acceso biométrico"}
      </p>
    )
  } else {
    subtitle = (
      <p className="text-xs text-muted-foreground">
        {native
          ? "Usa tu huella o bloqueo de pantalla para entrar rápido"
          : "Activa el inicio de sesión con huella / Face ID"}
      </p>
    )
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
          {native
            ? <Smartphone className="h-5 w-5 text-muted-foreground" />
            : <Fingerprint className="h-5 w-5 text-muted-foreground" />
          }
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">Acceso biométrico</p>
          {subtitle}
        </div>
      </div>

      {isSupported && (
        <div className="shrink-0">
          {registered ? (
            <Button
              size="sm" variant="outline"
              className="h-7 text-xs text-destructive border-destructive/30 hover:text-destructive"
              onClick={handleDeactivate}
            >
              Desactivar
            </Button>
          ) : (
            <Button
              size="sm" variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={handleRegister}
              disabled={isLoading}
            >
              {isLoading
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : native
                  ? <Smartphone className="h-3 w-3" />
                  : <Fingerprint className="h-3 w-3" />
              }
              Activar
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
