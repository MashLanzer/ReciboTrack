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
  Bell,
  MapPin,
  Camera,
  ChevronRight,
  Check,
  Sparkles,
  BarChart3,
  Shield,
} from "lucide-react"

// ─── Permission item ───────────────────────────────────────────────────────────

interface PermItem {
  id: "camera" | "location" | "notifications"
  icon: React.ReactNode
  title: string
  description: string
  color: string
}

const PERMISSIONS: PermItem[] = [
  {
    id: "camera",
    icon: <Camera className="h-5 w-5" />,
    title: "Cámara",
    description: "Escanea recibos con IA para añadir gastos al instante.",
    color: "bg-blue-500/15 text-blue-500",
  },
  {
    id: "location",
    icon: <MapPin className="h-5 w-5" />,
    title: "Ubicación",
    description: "Registra dónde gastas y descubre patrones en el mapa.",
    color: "bg-emerald-500/15 text-emerald-500",
  },
  {
    id: "notifications",
    icon: <Bell className="h-5 w-5" />,
    title: "Notificaciones",
    description: "Recibe alertas cuando te acerques a tu límite de presupuesto.",
    color: "bg-warning/15 text-warning",
  },
]

// ─── Dots indicator ────────────────────────────────────────────────────────────

function Dots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "rounded-full transition-all duration-300",
            i === current
              ? "w-6 h-2 bg-white"
              : i < current
              ? "w-2 h-2 bg-white/50"
              : "w-2 h-2 bg-white/20"
          )}
        />
      ))}
    </div>
  )
}

// ─── Feature slide ─────────────────────────────────────────────────────────────

interface Slide {
  gradient: string
  icon: React.ReactNode
  emoji: string
  eyebrow: string
  title: string
  description: string
}

const SLIDES: Slide[] = [
  {
    gradient: "from-violet-600 via-indigo-600 to-blue-600",
    icon: <Sparkles className="h-10 w-10 text-white/90" />,
    emoji: "✨",
    eyebrow: "Bienvenido a",
    title: "ReciboTrack",
    description:
      "La app inteligente que convierte tus recibos en datos, mantiene tus presupuestos bajo control y te ayuda a entender tus finanzas.",
  },
  {
    gradient: "from-blue-600 via-cyan-500 to-teal-500",
    icon: <ScanLine className="h-10 w-10 text-white/90" />,
    emoji: "📸",
    eyebrow: "Función estrella",
    title: "Escanea cualquier recibo",
    description:
      "Fotografía un ticket y la IA extrae automáticamente el comerciante, importe, categoría y fecha. Sin teclear nada.",
  },
  {
    gradient: "from-emerald-600 via-green-500 to-lime-500",
    icon: <PiggyBank className="h-10 w-10 text-white/90" />,
    emoji: "💰",
    eyebrow: "Control total",
    title: "Presupuestos inteligentes",
    description:
      "Define límites por categoría y recibe alertas antes de pasarte. Ve tus estadísticas y tendencias de un vistazo.",
  },
  {
    gradient: "from-orange-500 via-rose-500 to-pink-600",
    icon: <Users className="h-10 w-10 text-white/90" />,
    emoji: "👥",
    eyebrow: "Mejor juntos",
    title: "Gastos compartidos",
    description:
      "Crea grupos con amigos o familia, añade gastos compartidos y liquida cuentas al instante. Sin deudas olvidadas.",
  },
  {
    gradient: "from-slate-700 via-slate-600 to-slate-500",
    icon: <BarChart3 className="h-10 w-10 text-white/90" />,
    emoji: "📊",
    eyebrow: "Analíticas avanzadas",
    title: "Entiende tu dinero",
    description:
      "Gráficas de tendencias, comparativa mensual y sugerencias de la IA para optimizar tus finanzas.",
  },
]

// ─── Permissions slide ────────────────────────────────────────────────────────

function PermissionsSlide({ onDone }: { onDone: () => void }) {
  const [granted, setGranted] = useState<Set<string>>(new Set())
  const [requesting, setRequesting] = useState<string | null>(null)

  async function requestPerm(id: PermItem["id"]) {
    setRequesting(id)
    try {
      if (id === "camera") {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        stream.getTracks().forEach((t) => t.stop())
        setGranted((g) => new Set([...g, id]))
      } else if (id === "location") {
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(() => resolve(), reject, { timeout: 8000 })
        })
        setGranted((g) => new Set([...g, id]))
      } else if (id === "notifications") {
        const result = await Notification.requestPermission()
        if (result === "granted") setGranted((g) => new Set([...g, id]))
      }
    } catch {
      // Denied — silently skip (no alarm)
    } finally {
      setRequesting(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top section */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pt-12 pb-6 text-center space-y-3">
        <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center mb-2">
          <Shield className="h-8 w-8 text-white" />
        </div>
        <p className="text-white/70 text-sm font-medium uppercase tracking-wide">Paso final</p>
        <h2 className="text-2xl font-bold text-white leading-tight">
          Activa los permisos
        </h2>
        <p className="text-white/70 text-sm leading-relaxed max-w-xs">
          Para sacar el máximo partido a la app, necesitamos acceso a algunas funciones del dispositivo.
          Puedes cambiarlos en cualquier momento desde Ajustes.
        </p>
      </div>

      {/* Permission cards */}
      <div className="px-5 space-y-3 pb-4">
        {PERMISSIONS.map((perm) => {
          const isGranted = granted.has(perm.id)
          const isRequesting = requesting === perm.id
          return (
            <div
              key={perm.id}
              className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl p-4"
            >
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", perm.color)}>
                {perm.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold">{perm.title}</p>
                <p className="text-white/60 text-xs leading-snug mt-0.5">{perm.description}</p>
              </div>
              <button
                onClick={() => !isGranted && requestPerm(perm.id)}
                disabled={isGranted || isRequesting}
                className={cn(
                  "shrink-0 h-8 px-3 rounded-xl text-xs font-semibold transition-all",
                  isGranted
                    ? "bg-emerald-500/30 text-emerald-300 cursor-default"
                    : isRequesting
                    ? "bg-white/10 text-white/40 cursor-wait"
                    : "bg-white/20 text-white hover:bg-white/30 active:scale-95"
                )}
              >
                {isGranted ? "✓ Listo" : isRequesting ? "…" : "Permitir"}
              </button>
            </div>
          )
        })}
      </div>

      {/* CTA */}
      <div className="px-5 pb-10 pt-2">
        <button
          onClick={onDone}
          className="w-full h-12 rounded-2xl bg-white text-slate-900 font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <Check className="h-4 w-4" />
          Comenzar a usar ReciboTrack
        </button>
        <p className="text-center text-white/40 text-xs mt-3">
          Los permisos no otorgados se pueden activar más tarde en Ajustes del dispositivo.
        </p>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const LS_KEY = "recibotrack_onboarding_done"

export function Onboarding() {
  const { data: settings, isLoading } = useUserSettings()
  const updateSettings = useUpdateUserSettings()
  const { setScannerOpen } = useUIStore()
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [direction, setDirection] = useState<"forward" | "back">("forward")
  const [animating, setAnimating] = useState(false)

  // Show onboarding only when settings loaded + not completed.
  // localStorage is the primary gate so the onboarding never re-appears
  // even if the API call to save `onboardingCompleted` fails.
  useEffect(() => {
    // Fast path: already completed on this device
    if (typeof window !== "undefined" && localStorage.getItem(LS_KEY)) return

    if (!isLoading && settings && !settings.onboardingCompleted) {
      const t = setTimeout(() => setVisible(true), 600)
      return () => clearTimeout(t)
    }
  }, [isLoading, settings])

  if (!visible) return null

  const TOTAL = SLIDES.length + 1 // slides + permissions
  const isPermissions = step === SLIDES.length
  const currentSlide = isPermissions ? null : SLIDES[step]

  function complete() {
    // Persist locally first (reliable, instant) then sync to server
    localStorage.setItem(LS_KEY, "1")
    updateSettings.mutate({ onboardingCompleted: true })
    setVisible(false)
  }

  function navigate(dir: "forward" | "back") {
    if (animating) return
    setDirection(dir)
    setAnimating(true)
    setTimeout(() => {
      setStep((s) => (dir === "forward" ? s + 1 : Math.max(0, s - 1)))
      setAnimating(false)
    }, 180)
  }

  const gradient = isPermissions
    ? "from-slate-900 via-slate-800 to-slate-900"
    : currentSlide!.gradient

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] bg-gradient-to-br transition-all duration-700",
        gradient,
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      {/* Top safe area + skip */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-12 pb-4 z-10">
        <Dots total={TOTAL} current={step} />
        {!isPermissions && (
          <button
            onClick={complete}
            className="text-white/60 text-sm hover:text-white/90 transition-colors"
          >
            Saltar
          </button>
        )}
      </div>

      {/* Slide content */}
      {isPermissions ? (
        <div className="absolute inset-0 overflow-y-auto pt-20">
          <PermissionsSlide onDone={complete} />
        </div>
      ) : (
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center px-8 text-center pt-20 pb-32",
            "transition-all duration-180",
            animating
              ? direction === "forward"
                ? "opacity-0 translate-x-8"
                : "opacity-0 -translate-x-8"
              : "opacity-100 translate-x-0"
          )}
        >
          {/* Icon orb */}
          <div className="relative mb-8">
            <div className="h-28 w-28 rounded-[2rem] bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-2xl">
              {currentSlide!.icon}
            </div>
            <span
              className="absolute -bottom-3 -right-3 text-3xl select-none"
              role="img"
            >
              {currentSlide!.emoji}
            </span>
          </div>

          {/* Text */}
          <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-3">
            {currentSlide!.eyebrow}
          </p>
          <h1 className="text-3xl font-bold text-white leading-tight mb-4">
            {currentSlide!.title}
          </h1>
          <p className="text-white/75 text-base leading-relaxed max-w-xs">
            {currentSlide!.description}
          </p>
        </div>
      )}

      {/* Bottom nav — only for feature slides */}
      {!isPermissions && (
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-10 pt-4 flex gap-3">
          {step > 0 && (
            <button
              onClick={() => navigate("back")}
              className="h-12 px-5 rounded-2xl bg-white/10 text-white font-medium text-sm active:scale-95 transition-transform"
            >
              Atrás
            </button>
          )}
          <button
            onClick={() => navigate("forward")}
            className="flex-1 h-12 rounded-2xl bg-white text-slate-900 font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg"
          >
            {step === SLIDES.length - 1 ? "Configurar permisos" : "Continuar"}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
