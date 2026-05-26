"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { Banknote, Loader2, RefreshCw, Trash2, AlertCircle, Sparkles, ShieldCheck, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { usePlaidItems, useSyncItem, useDeleteItem, type PlaidItem, type PlaidAccount } from "@/hooks/use-plaid"
import { usePlan } from "@/hooks/use-plan"
import { PlaidLinkButton } from "@/components/banks/plaid-link-button"
import { ReconnectButton } from "@/components/banks/reconnect-button"

export default function BanksPage() {
  const { data: items, isLoading } = usePlaidItems()
  const { data: planData } = usePlan()
  const syncItem      = useSyncItem()
  const deleteItem    = useDeleteItem()
  const [confirmDelete, setConfirmDelete] = useState<PlaidItem | null>(null)

  const isPro = planData?.plan === "pro"

  // ─── Free user → upgrade gate ────────────────────────────────────────────
  if (!isPro) {
    return (
      <div className="space-y-4 p-4 max-w-md mx-auto">
        <div className="rounded-3xl border bg-card overflow-hidden">
          <div className="h-32 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent flex items-center justify-center">
            <Banknote className="h-12 w-12 text-primary" />
          </div>
          <div className="p-6 space-y-4">
            <div>
              <h1 className="text-xl font-black tracking-tight">Sincronización bancaria</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Conecta tu banco y deja que ReciboTrack importe todas tus transacciones
                automáticamente. Sin pegar recibos uno por uno.
              </p>
            </div>

            <ul className="space-y-2 text-sm">
              <li className="flex gap-2 items-start"><Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Importación automática de transacciones</li>
              <li className="flex gap-2 items-start"><Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Categorización inteligente de cada gasto</li>
              <li className="flex gap-2 items-start"><ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Conexión segura vía Plaid (mismo motor de Robinhood, Venmo, Cash App)</li>
            </ul>

            <Link href="/pricing" className="block">
              <Button className="w-full">Actualizar a Pro · $4.99/mes</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ─── Pro user ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 p-4 max-w-2xl mx-auto">
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => { if (!o) setConfirmDelete(null) }}
        title="¿Desconectar este banco?"
        description="Las transacciones ya importadas se mantendrán en tu historial. Para volver a sincronizar tendrás que reconectar el banco."
        confirmLabel="Desconectar"
        onConfirm={async () => {
          if (!confirmDelete) return
          try {
            await deleteItem.mutateAsync(confirmDelete.id)
            toast.success("Banco desconectado")
          } catch { toast.error("Error al desconectar") }
        }}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight">Bancos conectados</h1>
          <p className="text-xs text-muted-foreground">Auto-import vía Plaid</p>
        </div>
      </div>

      <PlaidLinkButton />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-28 rounded-2xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : !items || items.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border bg-muted/20">
          <Banknote className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Aún no has conectado ningún banco</p>
          <p className="text-xs text-muted-foreground mt-1">Pulsa "Conectar banco" arriba para empezar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <BankCard
              key={item.id}
              item={item}
              onSync={() => syncItem.mutate(item.id)}
              syncing={syncItem.isPending && syncItem.variables === item.id}
              onDelete={() => setConfirmDelete(item)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function BankCard({
  item, onSync, syncing, onDelete,
}: {
  item: PlaidItem
  onSync: () => void
  syncing: boolean
  onDelete: () => void
}) {
  const lastSynced = item.last_synced_at
    ? formatDistanceToNow(new Date(item.last_synced_at), { locale: es, addSuffix: true })
    : "nunca"

  return (
    <div
      className="rounded-2xl border bg-card overflow-hidden"
      style={item.primary_color ? { borderTopWidth: "3px", borderTopColor: item.primary_color } : undefined}
    >
      <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {item.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.logo} alt="" className="h-9 w-9 rounded-lg bg-muted object-contain shrink-0" />
          ) : (
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{item.institution_name ?? "Banco"}</p>
            <p className="text-xs text-muted-foreground">Última sync: {lastSynced}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="ghost" onClick={onSync} disabled={syncing} className="h-8">
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="h-8 text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {item.status === "error" && (
        <div className="px-4 py-2 bg-destructive/10 border-b flex gap-2 items-center justify-between">
          <div className="flex gap-2 items-start min-w-0">
            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">
              {item.error_message ?? "Error de conexión — reconecta el banco"}
            </p>
          </div>
          <ReconnectButton itemId={item.id} />
        </div>
      )}

      <div className="divide-y">
        {item.accounts.length === 0 ? (
          <p className="text-xs text-muted-foreground px-4 py-3">Sin cuentas</p>
        ) : (
          item.accounts.map((a) => <AccountRow key={a.id} a={a} />)
        )}
      </div>
    </div>
  )
}

function AccountRow({ a }: { a: PlaidAccount }) {
  const balance = a.current_balance
  const formatted = balance != null
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: a.currency ?? "USD" }).format(balance)
    : "—"
  const subtype = a.subtype ? a.subtype.charAt(0).toUpperCase() + a.subtype.slice(1) : a.type
  return (
    <div className="px-4 py-2.5 flex items-center justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">
          {a.name ?? "Cuenta"}
          {a.mask && <span className="text-xs text-muted-foreground ml-1.5">····{a.mask}</span>}
        </p>
        <p className="text-xs text-muted-foreground">{subtype}</p>
      </div>
      <p className="text-sm font-bold tabular-nums shrink-0">{formatted}</p>
    </div>
  )
}
