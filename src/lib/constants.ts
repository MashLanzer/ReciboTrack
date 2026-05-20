import type { CategoryDoc } from "@/types"

export const DEFAULT_CATEGORIES: CategoryDoc[] = [
  { id: "combustible", name: "Combustible", icon: "⛽", color: "#f97316", isDefault: true },
  { id: "comida", name: "Comida", icon: "🍔", color: "#eab308", isDefault: true },
  { id: "supermercado", name: "Supermercado", icon: "🛒", color: "#22c55e", isDefault: true },
  { id: "transporte", name: "Transporte", icon: "🚗", color: "#3b82f6", isDefault: true },
  { id: "ocio", name: "Ocio", icon: "🎮", color: "#a855f7", isDefault: true },
  { id: "salud", name: "Salud", icon: "💊", color: "#ef4444", isDefault: true },
  { id: "hogar", name: "Hogar", icon: "🏠", color: "#06b6d4", isDefault: true },
  { id: "servicios", name: "Servicios", icon: "💡", color: "#f59e0b", isDefault: true },
  { id: "otros", name: "Otros", icon: "📦", color: "#6b7280", isDefault: true },
]

export const PAYMENT_METHODS = [
  "Efectivo",
  "Visa",
  "Mastercard",
  "American Express",
  "Débito",
  "Transferencia",
  "PayPal",
  "Otro",
]

export const CURRENCIES = ["USD", "EUR", "MXN", "COP", "ARS", "CLP", "PEN", "BRL"]

export const DEFAULT_CURRENCY = "USD"

export const EXPENSES_PER_PAGE = 10

// Rate limits (deben coincidir con src/lib/api-auth.ts)
export const AI_RATE_LIMIT_PER_MIN  = 20
export const OCR_RATE_LIMIT_PER_MIN = 10
export const PAY_RATE_LIMIT_PER_MIN = 30

// Recurring page
export const LATER_PAGE_SIZE = 20

// App lock
export const LOCK_AFTER_BG_MS = 30_000 // 30 segundos
export const APP_LOCK_SESSION_KEY = "rbt_app_unlocked"
