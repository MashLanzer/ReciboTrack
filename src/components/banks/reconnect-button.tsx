"use client"

import { useCallback, useEffect, useState } from "react"
import { usePlaidLink } from "react-plaid-link"
import { toast } from "sonner"
import { Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useReconnectItem, useMarkItemActive } from "@/hooks/use-plaid"

/**
 * Botón "Reconectar". Cada banco con status=error tiene su propia instancia
 * — usePlaidLink mantiene su propio estado por instancia así que no chocan.
 */
export function ReconnectButton({ itemId }: { itemId: string }) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const reconnect    = useReconnectItem()
  const markActive   = useMarkItemActive()

  // Pre-cargamos el update-mode token al montar el botón
  useEffect(() => {
    if (linkToken) return
    reconnect.mutateAsync(itemId).then(setLinkToken).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSuccess = useCallback(() => {
    // Plaid Link en update mode no devuelve transacciones — solo termina la
    // re-auth. El webhook se encargará de marcar status=active la próxima vez
    // que Plaid emita un evento. Invalidamos query para refrescar UI.
    toast.success("Banco reconectado")
    markActive()
  }, [markActive])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  })

  const loading = reconnect.isPending

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => open()}
      disabled={!ready || !linkToken || loading}
      className="h-8 gap-1.5"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RotateCcw className="h-3.5 w-3.5" />
      )}
      Reconectar
    </Button>
  )
}
