"use client"

import { useState } from "react"
import { Fingerprint, Check, Loader2 } from "lucide-react"
import { usePasskeySupport, useRegisterPasskey, clearPasskey } from "@/hooks/use-passkey"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function PasskeySetupCard() {
  const isSupported = usePasskeySupport()
  const { register, isLoading } = useRegisterPasskey()
  const [registered, setRegistered] = useState(() => {
    if (typeof window === "undefined") return false
    return !!localStorage.getItem("rbt_passkey_cred")
  })

  async function handleRegister() {
    try {
      await register()
      setRegistered(true)
      toast.success("Acceso biométrico activado")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al registrar"
      toast.error(msg)
    }
  }

  function handleDeactivate() {
    clearPasskey()
    setRegistered(false)
    toast.success("Acceso biométrico desactivado")
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Fingerprint className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">Acceso biométrico</p>
          {!isSupported ? (
            <p className="text-xs text-muted-foreground">Tu dispositivo no soporta acceso biométrico</p>
          ) : registered ? (
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <Check className="h-3 w-3" />
              Activo — huella / Face ID
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Activa el inicio de sesión rápido</p>
          )}
        </div>
      </div>

      {isSupported && (
        <div className="shrink-0">
          {registered ? (
            <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30 hover:text-destructive"
              onClick={handleDeactivate}>
              Desactivar
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
              onClick={handleRegister} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Fingerprint className="h-3 w-3" />}
              Activar
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
