/**
 * Configuración central de los 3 tiers de plan de ReciboTrack.
 *
 * Cualquier cambio aquí debe reflejarse en:
 *   - /pricing page (UI)
 *   - migration que agregue/quite valores del CHECK constraint
 *   - Stripe products / price IDs en env vars
 */

export type Plan = "free" | "pro" | "premium"

/**
 * Jerarquía de planes. Un usuario con un plan tiene acceso a su tier y
 * todos los inferiores. ej: premium → puede usar features pro + free.
 */
const PLAN_RANK: Record<Plan, number> = {
  free:    0,
  pro:     1,
  premium: 2,
}

export function planHasAccess(userPlan: Plan, requiredPlan: Plan): boolean {
  return PLAN_RANK[userPlan] >= PLAN_RANK[requiredPlan]
}

/**
 * Matriz de límites y permisos por plan. Estos valores se leen desde
 * /api/plan y los endpoints relevantes para enforce.
 *
 * Convención: cuando el valor es boolean → permiso simple
 *             cuando es número → límite (Infinity = sin límite)
 *             requires: el tier mínimo que necesita acceso
 */
export interface PlanLimits {
  // Límites cuantitativos
  maxExpensesPerMonth: number  // free: 100, pro+: Infinity
  maxWorkspaces:       number  // free: 0, pro: 3, premium: Infinity
  ocrScansPerMonth:    number  // free: 15, pro+: Infinity

  // Permisos simples (true/false) — el tier mínimo lo determina la propia config
  csvExport:          boolean
  pdfReport:          boolean
  anomalyAlerts:      boolean
  changeHistory:      boolean
  aiCategorization:   boolean
  bankSync:           boolean  // Plaid — solo Premium
  forecastAI:         boolean  // Pronóstico IA — solo Premium
  webhooks:           boolean  // Webhooks salientes / API — solo Premium
  prioritySupport:    boolean  // solo Premium
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxExpensesPerMonth: 100,
    maxWorkspaces:       0,
    ocrScansPerMonth:    15,
    csvExport:           false,
    pdfReport:           false,
    anomalyAlerts:       false,
    changeHistory:       false,
    aiCategorization:    false,
    bankSync:            false,
    forecastAI:          false,
    webhooks:            false,
    prioritySupport:     false,
  },
  pro: {
    maxExpensesPerMonth: Infinity,
    maxWorkspaces:       3,
    ocrScansPerMonth:    Infinity,
    csvExport:           true,
    pdfReport:           true,
    anomalyAlerts:       true,
    changeHistory:       true,
    aiCategorization:    true,
    bankSync:            false,  // Premium only
    forecastAI:          false,  // Premium only
    webhooks:            false,  // Premium only
    prioritySupport:     false,  // Premium only
  },
  premium: {
    maxExpensesPerMonth: Infinity,
    maxWorkspaces:       Infinity,
    ocrScansPerMonth:    Infinity,
    csvExport:           true,
    pdfReport:           true,
    anomalyAlerts:       true,
    changeHistory:       true,
    aiCategorization:    true,
    bankSync:            true,
    forecastAI:          true,
    webhooks:            true,
    prioritySupport:     true,
  },
}

/**
 * Pricing display info. Usado por /pricing para mostrar las cards.
 * Mantén sincronizado con los productos reales en Stripe.
 */
export interface PlanPricing {
  id:           Plan
  label:        string
  priceUsd:     number
  priceLabel:   string
  description:  string
  cta:          string
  highlight:    boolean  // muestra como "popular"
}

export const PLAN_PRICING: Record<Plan, PlanPricing> = {
  free: {
    id:          "free",
    label:       "Gratis",
    priceUsd:    0,
    priceLabel:  "$0",
    description: "Lo esencial para llevar tus gastos",
    cta:         "Plan actual",
    highlight:   false,
  },
  pro: {
    id:          "pro",
    label:       "Pro",
    priceUsd:    1.99,
    priceLabel:  "$1.99",
    description: "Sin límites, exports y workspaces",
    cta:         "Suscribirse · $1.99/mes",
    highlight:   true,
  },
  premium: {
    id:          "premium",
    label:       "Premium",
    priceUsd:    4.99,
    priceLabel:  "$4.99",
    description: "Bank sync, IA, webhooks y todo lo demás",
    cta:         "Suscribirse · $4.99/mes",
    highlight:   false,
  },
}
