"use client"

import { useEffect, useState } from "react"
import { Fingerprint, Check, Loader2, Smartphone, ShieldCheck } from "lucide-react"
import { usePasskeySupport, useHasPasskey, useRegisterPasskey, clearPasskey, verifyPasskey } from "@/hooks/use-passkey"
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
  const [native, setNative]   = useState(false)
  const [testing, setTesting] = useState(false)

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

  async function handleTest() {
    setTesting(true)
    const result = await verifyPasskey()
    setTesting(false)
    if (result.ok) {
      toast.success("¡Biometría verificada correctamente!", {
        description: "Tu acceso biométrico funciona bien en este dispositivo.",
        duration: 4000,
      })
    } else {
      toast.error("Verificación fallida", {
        description: result.error,
      })
    }
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
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {registered ? (
            <>
              <Button
                size="sm" variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={handleTest}
                disabled={testing}
              >
                {testing
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <ShieldCheck className="h-3 w-3 text-emerald-600" />
                }
                Probar
              </Button>
              <Button
                size="sm" variant="ghost"
                className="h-6 text-[10px] text-destructive hover:text-destructive px-2"
                onClick={handleDeactivate}
              >
                Desactivar
              </Button>
            </>
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

