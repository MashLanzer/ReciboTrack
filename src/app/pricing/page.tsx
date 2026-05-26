"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Zap, Sparkles, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"
import { usePlan } from "@/hooks/use-plan"
import { apiFetch } from "@/lib/api-client"
import { cn } from "@/lib/utils"

const FREE_FEATURES = [
  "Hasta 100 gastos al mes",
  "Categorías ilimitadas",
  "Presupuestos básicos",
  "Dashboard con métricas",
  "Escaneo de recibos (OCR)",
]

const PRO_FEATURES = [
  "Gastos ilimitados",
  "Exportación CSV y PDF",
  "Pronóstico IA 3 meses",
  "Hasta 3 espacios de trabajo",
  "Alertas de anomalías",
  "Historial de cambios",
  "Webhooks salientes",
  "Reporte mensual PDF",
  "Soporte prioritario",
]

export default function PricingPage() {
  const { user } = useAuth()
  const { data: planData } = usePlan()
  const router  = useRouter()
  const [loading, setLoading] = useState(false)

  const isPro = planData?.plan === "pro"

  async function handleUpgrade() {
    if (!user) { router.push("/login?from=/pricing"); return }
    setLoading(true)
    try {
      const res  = await apiFetch("/api/checkout", { method: "POST" })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok) { toast.error(data.error ?? "Error al iniciar el pago"); return }
      window.location.href = data.url!
    } catch {
      toast.error("Error de red. Inténtalo de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  async function handleManage() {
    setLoading(true)
    try {
      const res  = await apiFetch("/api/customer-portal", { method: "POST" })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok) { toast.error(data.error ?? "Error"); return }
      window.location.href = data.url!
    } catch {
      toast.error("Error de red.")
    } finally {
      setLoading(false)
    }
  }

  function handleBack() {
    // Si hay historial, usa el back del navegador para preservar scroll.
    // Si no (deeplink directo), va al dashboard como fallback.
    if (typeof window !== "undefined" && window.history.length > 1) router.back()
    else router.push(user ? "/dashboard" : "/")
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 py-16">
      {/* Back button — sticky top-left */}
      <button
        onClick={handleBack}
        className="fixed top-4 left-4 z-10 flex items-center gap-1.5 rounded-full border bg-card/80 backdrop-blur px-3 py-1.5 text-sm font-medium hover:bg-card transition-colors"
        aria-label="Volver"
      >
        <ArrowLeft className="h-4 w-4" />
        Atrás
      </button>

      <div className="w-full max-w-3xl space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black tracking-tight">Planes</h1>
          <p className="text-muted-foreground">Elige el plan que mejor se adapte a ti</p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Free */}
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Gratis</p>
              <p className="text-4xl font-black mt-1">$0</p>
              <p className="text-sm text-muted-foreground">Para siempre</p>
            </div>
            <ul className="space-y-2">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2">
              <div className={cn(
                "w-full rounded-xl py-2.5 text-sm font-semibold text-center border",
                !isPro ? "bg-muted text-muted-foreground" : "border-border text-muted-foreground"
              )}>
                {!isPro ? "Tu plan actual" : "Plan básico"}
              </div>
            </div>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border-2 border-primary bg-card p-6 space-y-4 relative overflow-hidden">
            <div className="absolute top-3 right-3">
              <span className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">
                <Sparkles className="h-3 w-3" />
                Popular
              </span>
            </div>

            <div>
              <p className="text-sm font-semibold text-primary uppercase tracking-wide">Pro</p>
              <div className="flex items-baseline gap-1 mt-1">
                <p className="text-4xl font-black">$4.99</p>
                <p className="text-sm text-muted-foreground">/ mes</p>
              </div>
              <p className="text-sm text-muted-foreground">Cancela cuando quieras</p>
            </div>

            <ul className="space-y-2">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="pt-2">
              {isPro ? (
                <button
                  onClick={handleManage}
                  disabled={loading}
                  className="w-full rounded-xl py-2.5 text-sm font-bold border border-primary text-primary hover:bg-primary/5 transition-colors disabled:opacity-60"
                >
                  {loading ? "Cargando..." : "Gestionar suscripción"}
                </button>
              ) : (
                <button
                  onClick={handleUpgrade}
                  disabled={loading}
                  className="w-full rounded-xl py-2.5 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Zap className="h-4 w-4" />
                  {loading ? "Redirigiendo..." : "Suscribirse por $4.99/mes"}
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Pago seguro con Stripe · Cancela en cualquier momento · Sin cargos ocultos
        </p>
      </div>
    </div>
  )
}
