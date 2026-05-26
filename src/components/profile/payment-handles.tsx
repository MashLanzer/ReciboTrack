"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

interface ProfileHandles {
  paypal_handle:    string | null
  venmo_handle:     string | null
  cashapp_cashtag:  string | null
}

export function PaymentHandlesCard() {
  const [paypal,  setPaypal]  = useState("")
  const [venmo,   setVenmo]   = useState("")
  const [cashapp, setCashapp] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    let cancelled = false
    apiFetch("/api/profile")
      .then(r => r.ok ? r.json() as Promise<ProfileHandles> : null)
      .then(data => {
        if (cancelled || !data) return
        setPaypal(data.paypal_handle    ?? "")
        setVenmo(data.venmo_handle      ?? "")
        setCashapp(data.cashapp_cashtag ?? "")
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function save() {
    setSaving(true)
    try {
      const res = await apiFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          paypalHandle:   paypal.trim()  || null,
          venmoHandle:    venmo.trim()   || null,
          cashappCashtag: cashapp.trim() || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("Métodos de pago guardados")
    } catch {
      toast.error("Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border bg-card">
      <div className="px-4 py-3 border-b">
        <p className="text-sm font-semibold">Métodos para cobrar</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cuando compartas un enlace de pago, tus amigos verán estos botones para pagarte
        </p>
      </div>
      <div className="p-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="paypal" className="text-xs">PayPal.me — usuario</Label>
          <Input
            id="paypal"
            placeholder="johndoe (sin paypal.me/)"
            value={paypal}
            onChange={(e) => setPaypal(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="venmo" className="text-xs">Venmo — usuario</Label>
          <Input
            id="venmo"
            placeholder="JohnDoe (sin @)"
            value={venmo}
            onChange={(e) => setVenmo(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cashapp" className="text-xs">Cash App — $cashtag</Label>
          <Input
            id="cashapp"
            placeholder="$johndoe"
            value={cashapp}
            onChange={(e) => setCashapp(e.target.value)}
            disabled={loading}
          />
        </div>
        <Button onClick={save} disabled={loading || saving} size="sm" className="w-full">
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  )
}
