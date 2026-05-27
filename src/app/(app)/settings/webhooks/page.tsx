"use client"

import { useState } from "react"
import { useWebhooks, useCreateWebhook, useUpdateWebhook, useDeleteWebhook } from "@/hooks/use-webhooks"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Webhook, Plus, Trash2, ExternalLink, ChevronLeft, AlertCircle, CheckCircle2, Clock, Eye, EyeOff,
} from "lucide-react"
import Link from "next/link"

const ALL_EVENTS = [
  { value: "expense.created", label: "Gasto creado" },
  { value: "expense.updated", label: "Gasto actualizado" },
]

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: number | null }) {
  if (status === null) return (
    <Badge variant="secondary" className="text-xs gap-1">
      <Clock className="h-3 w-3" />
      Nunca disparado
    </Badge>
  )
  if (status >= 200 && status < 300) return (
    <Badge className="text-xs gap-1 bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20">
      <CheckCircle2 className="h-3 w-3" />
      {status}
    </Badge>
  )
  return (
    <Badge variant="destructive" className="text-xs gap-1 bg-destructive/15 text-destructive border-destructive/20">
      <AlertCircle className="h-3 w-3" />
      {status === 0 ? "Error de conexión" : status}
    </Badge>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        checked ? "bg-primary" : "bg-input"
      )}
    >
      <span className={cn(
        "pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
        checked ? "translate-x-5" : "translate-x-0"
      )} />
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WebhooksSettingsPage() {
  const { data: webhooks = [], isLoading } = useWebhooks()
  const createWebhook = useCreateWebhook()
  const updateWebhook = useUpdateWebhook()
  const deleteWebhook = useDeleteWebhook()

  const [showForm, setShowForm] = useState(false)
  const [url, setUrl] = useState("")
  const [secret, setSecret] = useState("")
  const [showSecret, setShowSecret] = useState(false)
  const [events, setEvents] = useState<string[]>(["expense.created", "expense.updated"])
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  function toggleEvent(ev: string) {
    setEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    )
  }

  async function handleCreate() {
    if (!url.trim()) { toast.error("La URL es requerida"); return }
    if (events.length === 0) { toast.error("Selecciona al menos un evento"); return }
    try {
      await createWebhook.mutateAsync({ url: url.trim(), secret: secret.trim() || undefined, events })
      toast.success("Webhook creado correctamente")
      setUrl("")
      setSecret("")
      setEvents(["expense.created", "expense.updated"])
      setShowForm(false)
    } catch (err) {
      toast.error((err as Error).message ?? "Error al crear webhook")
    }
  }

  async function handleToggle(id: string, currentEnabled: boolean) {
    try {
      await updateWebhook.mutateAsync({ id, updates: { enabled: !currentEnabled } })
    } catch {
      toast.error("Error al actualizar webhook")
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteWebhook.mutateAsync(deleteTarget)
      toast.success("Webhook eliminado")
      setDeleteTarget(null)
    } catch {
      toast.error("Error al eliminar webhook")
    }
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="¿Eliminar webhook?"
        description="Esta acción no se puede deshacer. El webhook dejará de recibir eventos."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />

      {/* ── Header ── */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Link href="/profile" className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            <h1 className="font-serif text-2xl">Webhooks</h1>
          </div>
        </div>
        <p className="text-sm text-muted-foreground pl-7">
          Recibe notificaciones en tiempo real cuando se creen o actualicen gastos. Compatible con Zapier, n8n y Make.
        </p>
      </div>

      {/* ── Webhooks list ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : webhooks.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-dashed p-10 text-center space-y-3">
          <Webhook className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium">Sin webhooks configurados</p>
            <p className="text-xs text-muted-foreground mt-1">Conecta ReciboTrack con otras herramientas y servicios</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            Añadir webhook
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div key={wh.id} className={cn(
              "rounded-2xl border p-4 space-y-3",
              !wh.enabled && "opacity-60"
            )}>
              {/* URL + toggle */}
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <a
                      href={wh.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono font-medium truncate hover:underline text-primary flex items-center gap-1"
                    >
                      {wh.url}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {wh.events.map((ev) => (
                      <span key={ev} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Toggle
                    checked={wh.enabled}
                    onChange={() => handleToggle(wh.id, wh.enabled)}
                    disabled={updateWebhook.isPending}
                  />
                  <button
                    onClick={() => setDeleteTarget(wh.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Status + last fired */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground border-t pt-2">
                <StatusBadge status={wh.last_status} />
                {wh.last_fired && (
                  <span>
                    Último disparo: {format(new Date(wh.last_fired), "dd MMM yyyy HH:mm", { locale: es })}
                  </span>
                )}
                {wh.secret && (
                  <span className="ml-auto flex items-center gap-1">
                    🔐 Secreto configurado
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Add button */}
          {!showForm && (
            <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Añadir webhook
            </Button>
          )}
        </div>
      )}

      {/* ── Form to add new webhook ── */}
      {showForm && (
        <div className="rounded-2xl border p-5 space-y-4">
          <h3 className="font-semibold text-sm">Nuevo webhook</h3>

          {/* URL */}
          <div className="space-y-1.5">
            <Label>URL del endpoint <span className="text-destructive">*</span></Label>
            <Input
              type="url"
              placeholder="https://tu-servidor.com/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          {/* Secret */}
          <div className="space-y-1.5">
            <Label>Secreto de verificación <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <div className="relative">
              <Input
                type={showSecret ? "text" : "password"}
                placeholder="Clave secreta para verificar autenticidad"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowSecret((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Se enviará en el header <code className="bg-muted px-1 rounded text-xs">X-Webhook-Secret</code> de cada petición.
            </p>
          </div>

          {/* Events */}
          <div className="space-y-2">
            <Label>Eventos <span className="text-destructive">*</span></Label>
            <div className="space-y-2">
              {ALL_EVENTS.map((ev) => (
                <label key={ev.value} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={events.includes(ev.value)}
                    onChange={() => toggleEvent(ev.value)}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <div>
                    <span className="text-sm font-medium">{ev.label}</span>
                    <span className="text-xs text-muted-foreground ml-2 font-mono">{ev.value}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleCreate}
              disabled={createWebhook.isPending || !url.trim() || events.length === 0}
              className="flex-1"
            >
              {createWebhook.isPending ? "Guardando..." : "Guardar webhook"}
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setUrl(""); setSecret("") }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* ── Info box ── */}
      <div className="rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1.5">
        <p className="font-semibold text-sm text-foreground">¿Cómo funcionan los webhooks?</p>
        <p>
          Cuando ocurre un evento (por ejemplo, se crea un gasto), ReciboTrack envía una petición
          HTTP POST a tu URL con el payload del evento en formato JSON.
        </p>
        <p className="font-mono text-xs bg-muted rounded p-2 mt-2">
          {`{ "event": "expense.created", "payload": {...}, "timestamp": "..." }`}
        </p>
        <p>Timeout: 5 segundos por petición.</p>
      </div>
    </div>
  )
}
