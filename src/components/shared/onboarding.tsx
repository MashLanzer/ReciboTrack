"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useExpenses } from "@/hooks/use-expenses"
import { useUIStore } from "@/stores/ui-store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  PlusCircle,
  PiggyBank,
  Repeat2,
  CheckCircle2,
} from "lucide-react"

const LS_KEY = "recibotrack_inapp_onboarding_done"

interface Step {
  id: string
  emoji: string
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

function useOnboardingSteps() {
  const router = useRouter()
  const { setQuickAddOpen } = useUIStore()

  const steps: Step[] = [
    {
      id: "welcome",
      emoji: "👋",
      title: "Bienvenido a ReciboTrack",
      description: "Registra tus gastos, controla tus presupuestos y entiende tus finanzas en un solo lugar.",
    },
    {
      id: "add-expense",
      emoji: "🧾",
      title: "Agrega tu primer gasto",
      description: "Pulsa el botón + para añadir un gasto manualmente o escanea un recibo con la cámara.",
      actionLabel: "Añadir gasto",
      onAction: () => setQuickAddOpen(true),
    },
    {
      id: "budgets",
      emoji: "💰",
      title: "Crea un presupuesto",
      description: "Define límites de gasto por categoría y recibe alertas antes de pasarte.",
      actionLabel: "Ver presupuestos",
      onAction: () => router.push("/budgets"),
    },
    {
      id: "recurring-income",
      emoji: "📅",
      title: "Configura tus ingresos",
      description: "Registra tus ingresos recurrentes para llevar un balance real de tus finanzas.",
      actionLabel: "Configurar ingresos",
      onAction: () => router.push("/recurring-income"),
    },
    {
      id: "done",
      emoji: "🎉",
      title: "¡Todo listo!",
      description: "Ya estás listo para tomar el control de tus finanzas. ¡Mucha suerte!",
    },
  ]

  return steps
}

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "rounded-full transition-all duration-300",
            i === current
              ? "w-5 h-1.5 bg-primary"
              : i < current
              ? "w-1.5 h-1.5 bg-primary/40"
              : "w-1.5 h-1.5 bg-muted-foreground/20"
          )}
        />
      ))}
    </div>
  )
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  welcome: <Sparkles className="h-6 w-6 text-primary" />,
  "add-expense": <PlusCircle className="h-6 w-6 text-primary" />,
  budgets: <PiggyBank className="h-6 w-6 text-primary" />,
  "recurring-income": <Repeat2 className="h-6 w-6 text-primary" />,
  done: <CheckCircle2 className="h-6 w-6 text-emerald-500" />,
}

export function Onboarding() {
  const steps = useOnboardingSteps()
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const { data, isLoading } = useExpenses({ page: 1 })

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(LS_KEY)) return
    if (!isLoading) {
      const hasExpenses = (data?.total ?? 0) > 0
      if (!hasExpenses) {
        const t = setTimeout(() => setVisible(true), 800)
        return () => clearTimeout(t)
      }
    }
  }, [isLoading, data?.total])

  function dismiss() {
    localStorage.setItem(LS_KEY, "1")
    setDismissed(true)
    setVisible(false)
  }

  function next() {
    if (step < steps.length - 1) {
      setStep((s) => s + 1)
    } else {
      dismiss()
    }
  }

  function prev() {
    if (step > 0) setStep((s) => s - 1)
  }

  if (!visible || dismissed) return null

  const current = steps[step]
  const isLast = step === steps.length - 1
  const icon = STEP_ICONS[current.id]

  return (
    <div
      className={cn(
        "fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 left-0 right-0 z-40 px-4 md:max-w-md md:left-auto md:right-6",
        "animate-in slide-in-from-bottom-4 duration-300"
      )}
    >
      <div className="bg-background border border-border rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <ProgressDots total={steps.length} current={step} />
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              Paso {step + 1} de {steps.length}
            </span>
            <button
              onClick={dismiss}
              className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Saltar introducción"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 pb-4 flex gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-snug">
              {current.emoji} {current.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {current.description}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 pb-4">
          {step > 0 ? (
            <Button variant="ghost" size="sm" className="gap-1 h-8 px-2" onClick={prev}>
              <ChevronLeft className="h-3.5 w-3.5" />
              Anterior
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="h-8 px-3 text-muted-foreground" onClick={dismiss}>
              Saltar
            </Button>
          )}

          <div className="flex-1" />

          {current.actionLabel && current.onAction && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => { current.onAction!(); dismiss() }}
            >
              {current.actionLabel}
            </Button>
          )}

          <Button
            size="sm"
            className="h-8 px-3 gap-1 text-xs"
            onClick={next}
          >
            {isLast ? "Comenzar" : "Siguiente"}
            {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
