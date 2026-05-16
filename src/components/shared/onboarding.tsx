"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings"
import { useUIStore } from "@/stores/ui-store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ScanLine,
  PiggyBank,
  Users,
  Zap,
  ChevronRight,
  Check,
  X,
} from "lucide-react"

// ─── Step definitions ─────────────────────────────────────────────────────────

interface Step {
  id: string
  icon: React.ReactNode
  emoji: string
  title: string
  description: string
  cta: string
  skip?: boolean
  action?: () => void
}

// ─── Dot indicator ────────────────────────────────────────────────────────────

function Dots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "rounded-full transition-all duration-300",
            i === current
              ? "w-5 h-2 bg-primary"
              : i < current
              ? "w-2 h-2 bg-primary/40"
              : "w-2 h-2 bg-muted-foreground/25"
          )}
        />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Onboarding() {
  const { data: settings, isLoading } = useUserSettings()
  const updateSettings = useUpdateUserSettings()
  const { setScannerOpen } = useUIStore()
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)

  // Show onboarding only when settings are loaded and not yet completed
  useEffect(() => {
    if (!isLoading && settings && !settings.onboardingCompleted) {
      // Small delay so the rest of the page renders first
      const t = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(t)
    }
  }, [isLoading, settings])

  if (!visible) return null

  const STEPS: Step[] = [
    {
      id: "welcome",
      emoji: "👋",
      icon: <Zap className="h-8 w-8" />,
      title: "Bienvenido a ReciboTrack",
      description:
        "Controla tus gastos con IA, comparte con grupos y mantén tus presupuestos bajo control. Este tour te lleva por las funciones clave en menos de un minuto.",
      cta: "Empezar",
    },
    {
      id: "scan",
      emoji: "📸",
      icon: <ScanLine className="h-8 w-8" />,
      title: "Escanea tu primer recibo",
      description:
        "Fotografía cualquier ticket y la IA extrae comerciante, importe y categoría automáticamente. Sin teclear nada.",
      cta: "Abrir scanner",
      action: () => {
        complete()
        setScannerOpen(true)
      },
    },
    {
      id: "budget",
      emoji: "💰",
      icon: <PiggyBank className="h-8 w-8" />,
      title: "Crea tu primer presupuesto",
      description:
        "Define cuánto puedes gastar en cada categoría al mes. Recibirás alertas al llegar al 75%, 90% y 100%.",
      cta: "Ir a presupuestos",
      action: () => {
        complete()
        router.push("/budgets")
      },
    },
    {
      id: "groups",
      emoji: "👥",
      icon: <Users className="h-8 w-8" />,
      title: "Comparte gastos en grupo",
      description:
        "Crea un grupo con amigos o familia, añade gastos compartidos y ajusta cuentas con un solo tap.",
      cta: "Ver grupos",
      action: () => {
        complete()
        router.push("/groups")
      },
    },
  ]

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  function complete() {
    updateSettings.mutate({ onboardingCompleted: true })
    setVisible(false)
  }

  function goNext() {
    if (current.action) {
      current.action()
      return
    }
    if (isLast) {
      complete()
      return
    }
    setAnimating(true)
    setTimeout(() => {
      setStep((s) => s + 1)
      setAnimating(false)
    }, 150)
  }

  function goPrev() {
    if (step === 0) return
    setAnimating(true)
    setTimeout(() => {
      setStep((s) => s - 1)
      setAnimating(false)
    }, 150)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />

      {/* Card */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div
          className={cn(
            "w-full max-w-sm bg-background rounded-3xl shadow-2xl overflow-hidden border",
            "transition-all duration-200",
            animating ? "opacity-0 scale-95" : "opacity-100 scale-100"
          )}
        >
          {/* Header strip */}
          <div className="relative h-36 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent flex items-center justify-center">
            {/* Skip button */}
            <button
              onClick={complete}
              className="absolute top-3 right-3 h-7 w-7 rounded-full bg-background/60 backdrop-blur-sm
                flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <span className="text-5xl select-none" role="img">
              {current.emoji}
            </span>
          </div>

          {/* Content */}
          <div className="px-6 pt-5 pb-6 space-y-4">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold leading-snug">{current.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {current.description}
              </p>
            </div>

            {/* Step dots */}
            <div className="flex items-center justify-between">
              <Dots total={STEPS.length} current={step} />
              <span className="text-xs text-muted-foreground">
                {step + 1} / {STEPS.length}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              {step > 0 && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={goPrev}
                >
                  Atrás
                </Button>
              )}
              <Button className="flex-1 gap-2" onClick={goNext}>
                {current.cta}
                {isLast || current.action ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Skip all */}
            {step < STEPS.length - 1 && (
              <button
                onClick={complete}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center pt-0.5"
              >
                Saltar introducción
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
