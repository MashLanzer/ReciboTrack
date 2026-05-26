"use client"

import { useCallback, useEffect, useState } from "react"
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from "react-plaid-link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, AlertCircle, RotateCcw } from "lucide-react"
import { useCreateLinkToken, useExchangePublicToken } from "@/hooks/use-plaid"

/**
 * Botón "Conectar banco". Internamente:
 *   1. Llama POST /api/plaid/link-token → obtiene link_token
 *   2. Pasa link_token a usePlaidLink (de react-plaid-link)
 *   3. Al click abre el modal de Plaid Link
 *   4. Plaid devuelve public_token → POST /api/plaid/exchange
 *   5. Toast con "X transacciones importadas"
 */
export function PlaidLinkButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const createLinkToken = useCreateLinkToken()
  const exchange        = useExchangePublicToken()

  const fetchToken = useCallback(() => {
    setError(null)
    createLinkToken
      .mutateAsync()
      .then(setLinkToken)
      .catch((err: Error & { upgrade?: string }) => {
        if (err.upgrade) {
          toast.error("Necesitas el plan Pro", {
            action: { label: "Ver planes", onClick: () => { window.location.href = err.upgrade! } },
          })
          setError("Plan Pro requerido")
        } else {
          // Surface the real error — antes se tragaba silenciosamente y dejaba
          // el botón "desactivado para siempre" sin pista de por qué.
          setError(err.message || "Error al iniciar Plaid")
          toast.error(err.message || "Error al iniciar Plaid")
        }
      })
  }, [createLinkToken])

  useEffect(() => {
    if (linkToken || error) return
    fetchToken()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSuccess = useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      try {
        const result = await exchange.mutateAsync({
          publicToken,
          institution: metadata.institution
            ? { id: metadata.institution.institution_id, name: metadata.institution.name }
            : undefined,
        }) as { sync?: { added: number } }
        const added = result?.sync?.added ?? 0
        toast.success(`Banco conectado · ${added} transacciones importadas`)
        // Refrescar link token para una próxima conexión
        setLinkToken(null)
        fetchToken()
      } catch (err) {
        toast.error((err as Error).message)
      }
    },
    [exchange, fetchToken],
  )

  const { open, ready } = usePlaidLink({
    token:  linkToken,
    onSuccess,
  })

  const loading = createLinkToken.isPending || exchange.isPending

  // Si hay error mostramos un estado dedicado con botón "Reintentar"
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-destructive">{error}</p>
        </div>
        <Button
          onClick={fetchToken}
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <Button
      onClick={() => open()}
      disabled={!ready || !linkToken || loading}
      className="w-full gap-2"
    >
      {loading || !linkToken ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {loading ? "Cargando…" : "Preparando…"}
        </>
      ) : (
        <>
          <Plus className="h-4 w-4" />
          Conectar banco
        </>
      )}
    </Button>
  )
}
