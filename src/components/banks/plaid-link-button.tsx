"use client"

import { useCallback, useEffect, useState } from "react"
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from "react-plaid-link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Loader2, Plus } from "lucide-react"
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
  const createLinkToken = useCreateLinkToken()
  const exchange        = useExchangePublicToken()

  // Pedir el link_token al montar el componente (precarga para click rápido)
  useEffect(() => {
    if (linkToken) return
    createLinkToken
      .mutateAsync()
      .then(setLinkToken)
      .catch((err: Error & { upgrade?: string }) => {
        if (err.upgrade) {
          toast.error("Necesitas el plan Pro", {
            action: { label: "Ver planes", onClick: () => { window.location.href = err.upgrade! } },
          })
        }
        // Otros errores se mostrarán cuando el usuario presione el botón
      })
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
        createLinkToken.mutateAsync().then(setLinkToken).catch(() => {})
      } catch (err) {
        toast.error((err as Error).message)
      }
    },
    [exchange, createLinkToken],
  )

  const { open, ready } = usePlaidLink({
    token:  linkToken,
    onSuccess,
  })

  const loading = createLinkToken.isPending || exchange.isPending

  return (
    <Button
      onClick={() => open()}
      disabled={!ready || !linkToken || loading}
      className="w-full gap-2"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
      Conectar banco
    </Button>
  )
}
