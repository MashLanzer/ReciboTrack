/**
 * Tiered benefits based on number of expenses logged.
 */

export type Tier = "bronce" | "plata" | "oro" | "diamante"

export interface TierInfo {
  tier: Tier
  label: string
  emoji: string
  minExpenses: number
  nextTier: Tier | null
  nextAt: number | null
  benefits: string[]
  color: string
}

const TIERS: TierInfo[] = [
  {
    tier: "bronce",
    label: "Bronce",
    emoji: "🥉",
    minExpenses: 0,
    nextTier: "plata",
    nextAt: 25,
    benefits: [
      "Escaneo OCR de recibos",
      "Historial de gastos ilimitado",
      "Exportación CSV básica",
    ],
    color: "text-amber-700 dark:text-amber-500",
  },
  {
    tier: "plata",
    label: "Plata",
    emoji: "🥈",
    minExpenses: 25,
    nextTier: "oro",
    nextAt: 100,
    benefits: [
      "Todo lo de Bronce",
      "Análisis de 6 meses",
      "Metas de ahorro",
      "Grupos colaborativos",
    ],
    color: "text-slate-500 dark:text-slate-400",
  },
  {
    tier: "oro",
    label: "Oro",
    emoji: "🥇",
    minExpenses: 100,
    nextTier: "diamante",
    nextAt: 500,
    benefits: [
      "Todo lo de Plata",
      "PDF con logo",
      "Portal compartido",
      "Automatizaciones",
      "Detección de duplicados",
    ],
    color: "text-yellow-600 dark:text-yellow-400",
  },
  {
    tier: "diamante",
    label: "Diamante",
    emoji: "💎",
    minExpenses: 500,
    nextTier: null,
    nextAt: null,
    benefits: [
      "Todo lo de Oro",
      "IA de sugerencias avanzada",
      "Webhook ilimitados",
      "Acceso anticipado a funciones",
      "Logros exclusivos",
    ],
    color: "text-cyan-600 dark:text-cyan-400",
  },
]

export function computeTier(totalExpenses: number): TierInfo & { progress: number } {
  let current = TIERS[0]
  for (const t of TIERS) {
    if (totalExpenses >= t.minExpenses) current = t
  }

  let progress = 100
  if (current.nextAt !== null) {
    const range = current.nextAt - current.minExpenses
    const done = totalExpenses - current.minExpenses
    progress = Math.min(Math.round((done / range) * 100), 100)
  }

  return { ...current, progress }
}
