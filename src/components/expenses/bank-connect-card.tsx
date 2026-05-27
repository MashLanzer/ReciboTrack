"use client"

import { useState } from "react"
import { useBankConnections, useConnectBank, useDisconnectBank, useSyncBank } from "@/hooks/use-bank-connections"
import { toast } from "sonner"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Building2, RefreshCw, Trash2, Plus, Wifi, WifiOff, AlertCircle } from "lucide-react"

declare global {
  interface Window {
    belvoSDK?: {
      createWidget: (token: string, options: {
        locale?: string
        country_codes?: string[]
        callback: (link: string, institution: string) => void
        onExit?: (data: unknown) => void
        onError?: (data: unknown) => void
      }) => { build: () => void }
    }
  }
}

export function BankConnectCard() {
  const { data: connections = [], isLoading } = useBankConnections()
  const connectBank = useConnectBank()
  const disconnectBank = useDisconnectBank()
  const syncBank = useSyncBank()
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  async function handleConnect() {
    try {
      const { token } = await connectBank.mutateAsync()

      // Load Belvo SDK dynamically
      if (!window.belvoSDK) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script")
          script.src = "https://cdn.belvo.io/belvo-widget-1-stable.js"
          script.onload = () => resolve()
          script.onerror = () => reject(new Error("No se pudo cargar el widget de Belvo"))
          document.head.appendChild(script)
        })
      }

      window.belvoSDK!.createWidget(token, {
        locale: "es",
        country_codes: ["MX", "CO", "BR", "AR", "PE", "CL"],
        callback: (link, institution) => {
          toast.success(`Banco conectado: ${institution}`)
          window.location.href = `/api/belvo/callback?link=${link}&uid=auto&institution=${institution}`
        },
        onExit: () => { /* user closed */ },
        onError: (err) => {
          console.error("[Belvo widget]", err)
          toast.error("Error al conectar el banco")
        },
      }).build()
    } catch (err) {
      toast.error((err as Error).message ?? "Error al conectar banco")
    }
  }

  async function handleSync(connection: { id: string; belvo_link_id: string; institution_name: string }) {
    setSyncingId(connection.id)
    try {
      const { imported } = await syncBank.mutateAsync(connection.belvo_link_id)
      toast.success(`${imported} transacciones nuevas importadas de ${connection.institution_name}`)
    } catch (err) {
      toast.error((err as Error).message ?? "Error al sincronizar")
    } finally {
      setSyncingId(null)
    }
  }

  return (
    <>
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="¿Desconectar banco?"
        description="Se eliminarán los gastos vinculados a esta conexión bancaria no se borrarán, pero no se importarán más transacciones."
        confirmLabel="Desconectar"
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await disconnectBank.mutateAsync(deleteTarget)
            toast.success("Banco desconectado")
            setDeleteTarget(null)
          } catch {
            toast.error("Error al desconectar")
          }
        }}
      />

      <div className="rounded-2xl border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">Cuentas bancarias</h3>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={handleConnect} disabled={connectBank.isPending}>
            <Plus className="h-3.5 w-3.5" />
            Conectar banco
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : connections.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center space-y-2">
            <Building2 className="h-7 w-7 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium">Sin bancos conectados</p>
            <p className="text-xs text-muted-foreground">
              Conecta tu banco para importar transacciones automáticamente (México, Colombia, Brasil, y más)
            </p>
            <Button size="sm" className="gap-1.5 mt-1" onClick={handleConnect} disabled={connectBank.isPending}>
              <Plus className="h-3.5 w-3.5" />
              {connectBank.isPending ? "Cargando..." : "Conectar mi primer banco"}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {connections.map((conn) => (
              <div key={conn.id} className="flex items-center gap-3 rounded-xl border p-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{conn.institution_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {conn.status === "valid" ? (
                      <Badge className="text-[10px] h-4 px-1.5 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                        <Wifi className="h-2.5 w-2.5 mr-0.5" /> Conectado
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                        <WifiOff className="h-2.5 w-2.5 mr-0.5" /> Error
                      </Badge>
                    )}
                    {conn.last_synced_at && (
                      <span className="text-[10px] text-muted-foreground">
                        Últ. sync: {format(new Date(conn.last_synced_at), "dd MMM HH:mm", { locale: es })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleSync(conn)}
                    disabled={syncingId === conn.id}
                    title="Sincronizar transacciones"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncingId === conn.id ? "animate-spin" : ""}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(conn.id)}
                    title="Desconectar banco"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground text-center pt-1 flex items-center justify-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Las transacciones se sincronizan automáticamente cada día
            </p>
          </div>
        )}
      </div>
    </>
  )
}
