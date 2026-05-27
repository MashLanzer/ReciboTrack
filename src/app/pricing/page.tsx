"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Check, Sparkles, ArrowLeft, FlaskConical, Crown, Zap, Banknote } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"
import { usePlan } from "@/hooks/use-plan"
import { apiFetch } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import type { Plan } from "@/lib/plan-config"

interface FeatureRow {
  label:   string
  free:    string | boolean
  pro:     string | boolean
  premium: string | boolean
  icon?:   React.ElementType
}

const FEATURES: FeatureRow[] = [
  { label: "Gastos por mes",            free: "100",  pro: "Ilimitados", premium: "Ilimitados" },
  { label: "Escaneo OCR de recibos",    free: true,   pro: true,         premium: true },
  { label: "Categorías y presupuestos", free: true,   pro: true,         premium: true },
  { label: "Perfil público @handle",    free: true,   pro: true,         premium: true },
  { label: "Exportación CSV/PDF",       free: false,  pro: true,         premium: true },
  { label: "Reporte mensual PDF",       free: false,  pro: true,         premium: true },
  { label: "Alertas de anomalías",      free: false,  pro: true,         premium: true },
  { label: "Historial de cambios",      free: false,  pro: true,         premium: true },
  { label: "Categorización con IA",     free: false,  pro: true,         premium: true },
  { label: "Workspaces compartidos",    free: "0",    pro: "3",          premium: "Ilimitados" },
  { label: "Sincronización bancaria",   free: false,  pro: false,        premium: true, icon: Banknote },
  { label: "Pronóstico IA 3 meses",     free: false,  pro: false,        premium: true },
  { label: "Webhooks salientes / API",  free: false,  pro: false,        premium: true },
  { label: "Soporte prioritario",       free: false,  pro: false,        premium: true },
]

export default function PricingPage() {
  const { user } = useAuth()
  const { data: planData } = usePlan()
  const router  = useRouter()
  const queryClient = useQueryClient()
  const [loading,     setLoading]     = useState<Plan | null>(null)
  const [devGranting, setDevGranting] = useState<Plan | null>(null)

  const currentPlan: Plan = planData?.plan ?? "free"

  const devAllowedUid = process.env.NEXT_PUBLIC_DEV_PRO_GRANT_UID
  const canDevGrant   = !!devAllowedUid && !!user && user.uid === devAllowedUid

  async function handleSubscribe(plan: Plan) {
    if (!user) { router.push("/login?from=/pricing"); return }
    setLoading(plan)
    try {
      const res  = await apiFetch("/api/checkout", { method: "POST", body: JSON.stringify({ plan }) })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok) { toast.error(data.error ?? "Error al iniciar el pago"); return }
      window.location.href = data.url!
    } catch {
      toast.error("Error de red. Inténtalo de nuevo.")
    } finally {
      setLoading(null)
    }
  }

  async function handleManage() {
    setLoading(currentPlan)
    try {
      const res  = await apiFetch("/api/customer-portal", { method: "POST" })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok) { toast.error(data.error ?? "Error"); return }
      window.location.href = data.url!
    } catch {
      toast.error("Error de red.")
    } finally {
      setLoading(null)
    }
  }

  async function handleDevGrant(plan: Plan) {
    setDevGranting(plan)
    try {
      const res = await apiFetch("/api/dev/grant-pro", {
        method: "POST",
        body: JSON.stringify({ plan }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { toast.error(data.error ?? "Error"); return }
      toast.success(`Plan ${plan} activado (modo dev)`)
      queryClient.invalidateQueries({ queryKey: ["plan"] })
    } catch {
      toast.error("Error de red.")
    } finally {
      setDevGranting(null)
    }
  }

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back()
    else router.push(user ? "/dashboard" : "/")
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-4 py-16">
      <button
        onClick={handleBack}
        className="fixed top-4 left-4 z-10 flex items-center gap-1.5 rounded-full border bg-card/80 backdrop-blur px-3 py-1.5 text-sm font-medium hover:bg-card transition-colors"
        aria-label="Volver"
      >
        <ArrowLeft className="h-4 w-4" />
        Atrás
      </button>

      <div className="w-full max-w-5xl space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black tracking-tight">Planes</h1>
          <p className="text-muted-foreground">Elige el plan que mejor se adapte a ti</p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Free */}
          <PlanCard
            tier="free"
            title="Gratis"
            price="$0"
            tagline="Para siempre"
            description="Lo esencial para llevar tus gastos"
            current={currentPlan === "free"}
            ctaLabel="Plan actual"
            ctaDisabled
            highlightFeatures={["Hasta 100 gastos/mes", "OCR de recibos", "Categorías y presupuestos"]}
          />

          {/* Pro */}
          <PlanCard
            tier="pro"
            title="Pro"
            price="$1.99"
            tagline="/ mes"
            description="Sin límites, exports y workspaces"
            current={currentPlan === "pro"}
            badge="Más popular"
            badgeIcon={Zap}
            ctaLabel={
              currentPlan === "pro"      ? "Gestionar suscripción" :
              currentPlan === "premium"  ? "Tienes Premium" :
              loading === "pro"          ? "Redirigiendo…" : "Suscribirse · $1.99/mes"
            }
            ctaDisabled={loading !== null || currentPlan === "premium"}
            ctaOnClick={currentPlan === "pro" ? handleManage : () => handleSubscribe("pro")}
            highlightFeatures={["Gastos ilimitados", "CSV / PDF / Reporte mensual", "3 workspaces compartidos", "Categorización con IA"]}
          />

          {/* Premium */}
          <PlanCard
            tier="premium"
            title="Premium"
            price="$4.99"
            tagline="/ mes"
            description="Bank sync, IA y power-user"
            current={currentPlan === "premium"}
            badge="Para power users"
            badgeIcon={Crown}
            highlight
            ctaLabel={
              currentPlan === "premium"  ? "Gestionar suscripción" :
              loading === "premium"      ? "Redirigiendo…" : "Suscribirse · $4.99/mes"
            }
            ctaDisabled={loading !== null}
            ctaOnClick={currentPlan === "premium" ? handleManage : () => handleSubscribe("premium")}
            highlightFeatures={["Todo lo de Pro", "🏦 Sincronización bancaria", "Pronóstico IA 3 meses", "Workspaces ilimitados", "Soporte prioritario"]}
          />
        </div>

        {/* Comparison table */}
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-semibold">Comparativa completa</p>
          </div>
          <div className="divide-y text-sm">
            <div className="grid grid-cols-4 px-4 py-2.5 bg-muted/30 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
              <span>Feature</span>
              <span className="text-center">Gratis</span>
              <span className="text-center">Pro</span>
              <span className="text-center">Premium</span>
            </div>
            {FEATURES.map((f) => (
              <div key={f.label} className="grid grid-cols-4 px-4 py-2.5 items-center">
                <span className="flex items-center gap-1.5">
                  {f.icon && <f.icon className="h-3.5 w-3.5 text-muted-foreground" />}
                  {f.label}
                </span>
                <FeatureCell value={f.free} />
                <FeatureCell value={f.pro} />
                <FeatureCell value={f.premium} />
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Pago seguro con Stripe · Cancela en cualquier momento · Sin cargos ocultos
        </p>

        {/* DEV grant — visible solo al UID dev */}
        {canDevGrant && (
          <div className="rounded-2xl border-2 border-dashed border-amber-500/50 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <FlaskConical className="h-4 w-4" />
              <p className="text-xs font-bold uppercase tracking-wider">Modo desarrollo</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Bypass del paywall solo para tu cuenta.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleDevGrant("free")}
                disabled={devGranting !== null || currentPlan === "free"}
                className="rounded-xl py-2.5 text-xs font-bold bg-amber-500/10 border border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors disabled:opacity-40"
              >
                {devGranting === "free" ? "…" : "Free"}
              </button>
              <button
                onClick={() => handleDevGrant("pro")}
                disabled={devGranting !== null || currentPlan === "pro"}
                className="rounded-xl py-2.5 text-xs font-bold bg-amber-500/10 border border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors disabled:opacity-40"
              >
                {devGranting === "pro" ? "…" : "Pro"}
              </button>
              <button
                onClick={() => handleDevGrant("premium")}
                disabled={devGranting !== null || currentPlan === "premium"}
                className="rounded-xl py-2.5 text-xs font-bold bg-amber-500/10 border border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors disabled:opacity-40"
              >
                {devGranting === "premium" ? "…" : "Premium"}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Plan actual: <strong>{currentPlan}</strong> · Cambia entre los 3 para probar gates
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

interface PlanCardProps {
  tier:                Plan
  title:               string
  price:               string
  tagline:             string
  description:         string
  current:             boolean
  badge?:              string
  badgeIcon?:          React.ElementType
  highlight?:          boolean
  ctaLabel:            string
  ctaDisabled?:        boolean
  ctaOnClick?:         () => void
  highlightFeatures:   string[]
}

function PlanCard(p: PlanCardProps) {
  return (
    <div className={cn(
      "rounded-2xl border bg-card p-6 space-y-4 relative overflow-hidden",
      p.highlight && "border-2 border-primary"
    )}>
      {p.badge && (
        <div className="absolute top-3 right-3">
          <span className={cn(
            "flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full",
            p.highlight
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          )}>
            {p.badgeIcon && <p.badgeIcon className="h-3 w-3" />}
            {p.badge}
          </span>
        </div>
      )}

      <div>
        <p className={cn(
          "text-sm font-semibold uppercase tracking-wide",
          p.highlight ? "text-primary" : "text-muted-foreground"
        )}>{p.title}</p>
        <div className="flex items-baseline gap-1 mt-1">
          <p className="text-4xl font-black">{p.price}</p>
          <p className="text-sm text-muted-foreground">{p.tagline}</p>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
      </div>

      <ul className="space-y-2">
        {p.highlightFeatures.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className={cn("h-4 w-4 mt-0.5 shrink-0", p.highlight ? "text-primary" : "text-muted-foreground")} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="pt-2">
        {p.current ? (
          <div className="w-full rounded-xl py-2.5 text-sm font-semibold text-center border bg-muted text-muted-foreground">
            Tu plan actual
          </div>
        ) : (
          <button
            onClick={p.ctaOnClick}
            disabled={p.ctaDisabled}
            className={cn(
              "w-full rounded-xl py-2.5 text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60",
              p.tier === "premium"
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : p.tier === "pro"
                ? "border-2 border-primary text-primary hover:bg-primary/5"
                : "border bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {p.tier === "premium" && <Sparkles className="h-4 w-4" />}
            {p.ctaLabel}
          </button>
        )}
      </div>
    </div>
  )
}

function FeatureCell({ value }: { value: string | boolean }) {
  if (value === true)  return <span className="text-center text-primary">✓</span>
  if (value === false) return <span className="text-center text-muted-foreground/40">—</span>
  return <span className="text-center text-xs font-semibold">{value}</span>
}
