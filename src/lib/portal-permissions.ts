/**
 * Portal Permission System
 * Server-side (and client-safe) logic for applying fine-grained data masks
 * to expense arrays before sending to unauthenticated portal viewers.
 */

import type { Expense } from "@/types"

// ── Types ─────────────────────────────────────────────────────────────────────

export type PortalRole = "accountant" | "partner" | "associate" | "custom"

export interface PortalPermissions {
  showMerchants: boolean        // if false → masked to "***"
  showNotes: boolean            // if false → notes hidden
  showAmounts: boolean          // if false → amounts shown as "***"
  showCategories: boolean       // if false → categories hidden
  showTotalsOnly: boolean       // if true → only aggregate, no line items
  showItems: boolean            // if false → receipt line items hidden
  showPaymentMethod: boolean    // if false → payment method hidden
  showTags: boolean             // if false → tags hidden
  allowedCategories: string[]   // empty = all allowed
  dateRange: { from: string; to: string } | null  // ISO strings, null = no restriction
}

export interface Portal {
  id: string
  name: string
  token: string
  role: PortalRole
  permissions: PortalPermissions
  expiresAt: string | null      // ISO string
  revoked: boolean
  lastAccessedAt: string | null // ISO string
  accessCount: number
  targetLabel: string           // "Ana García - Contadora"
  ownerUid: string
  ownerName: string
  createdAt: string             // ISO string
}

export interface PortalInput {
  name: string
  role: PortalRole
  permissions: PortalPermissions
  expiresAt: string | null
  targetLabel: string
}

// ── Role presets ──────────────────────────────────────────────────────────────

export const ROLE_PRESETS: Record<PortalRole, { label: string; description: string; emoji: string; permissions: PortalPermissions }> = {
  accountant: {
    label: "Contador / Contable",
    description: "Ve todos los importes e ítems, pero sin notas personales. Solo categorías marcadas como deducibles.",
    emoji: "🧾",
    permissions: {
      showMerchants: true,
      showNotes: false,
      showAmounts: true,
      showCategories: true,
      showTotalsOnly: false,
      showItems: true,
      showPaymentMethod: true,
      showTags: true,
      allowedCategories: [],    // owner should fill in deductible categories
      dateRange: null,
    },
  },
  partner: {
    label: "Pareja / Familiar",
    description: "Acceso completo. Ven todo como tú lo ves.",
    emoji: "💑",
    permissions: {
      showMerchants: true,
      showNotes: true,
      showAmounts: true,
      showCategories: true,
      showTotalsOnly: false,
      showItems: true,
      showPaymentMethod: true,
      showTags: true,
      allowedCategories: [],
      dateRange: null,
    },
  },
  associate: {
    label: "Socio de negocio",
    description: "Solo totales por categoría, sin comercios ni notas. Ideal para reportes de resumen.",
    emoji: "🤝",
    permissions: {
      showMerchants: false,
      showNotes: false,
      showAmounts: true,
      showCategories: true,
      showTotalsOnly: true,
      showItems: false,
      showPaymentMethod: false,
      showTags: false,
      allowedCategories: [],
      dateRange: null,
    },
  },
  custom: {
    label: "Personalizado",
    description: "Configura exactamente qué puede ver.",
    emoji: "⚙️",
    permissions: {
      showMerchants: true,
      showNotes: false,
      showAmounts: true,
      showCategories: true,
      showTotalsOnly: false,
      showItems: true,
      showPaymentMethod: true,
      showTags: true,
      allowedCategories: [],
      dateRange: null,
    },
  },
}

// ── Permission application ────────────────────────────────────────────────────

export interface MaskedExpense {
  id: string
  merchant: string | "***"
  date: string               // ISO
  category: string | null
  total: number | "***"
  subtotal: number | "***"
  tax: number | "***"
  currency: string
  notes: string | null
  paymentMethod: string | null
  tags: string[]
  items: Array<{ name: string; price: number | "***"; quantity: number }> | null
}

export interface PortalSummary {
  totalAmount: number
  expenseCount: number
  byCategory: { category: string; total: number; count: number }[]
  dateRange: { from: string; to: string } | null
}

export interface PortalData {
  expenses: MaskedExpense[]
  summary: PortalSummary
  permissions: PortalPermissions
  portalName: string
  ownerName: string
  generatedAt: string
}

/** Apply portal permissions to a list of raw expenses */
export function applyPortalPermissions(
  expenses: Expense[],
  permissions: PortalPermissions,
): MaskedExpense[] {
  let filtered = [...expenses]

  // Date range filter
  if (permissions.dateRange) {
    const from = new Date(permissions.dateRange.from).getTime()
    const to   = new Date(permissions.dateRange.to).getTime()
    filtered = filtered.filter((e) => {
      const d = toDate(e.date).getTime()
      return d >= from && d <= to
    })
  }

  // Category filter
  if (permissions.allowedCategories.length > 0) {
    filtered = filtered.filter((e) =>
      permissions.allowedCategories.includes(e.category ?? "otros"),
    )
  }

  return filtered.map((e): MaskedExpense => ({
    id: e.id,
    merchant:      permissions.showMerchants ? e.merchant : "***",
    date:          toDate(e.date).toISOString(),
    category:      permissions.showCategories ? (e.category ?? null) : null,
    total:         permissions.showAmounts    ? e.total    : "***",
    subtotal:      permissions.showAmounts    ? e.subtotal : "***",
    tax:           permissions.showAmounts    ? e.tax      : "***",
    currency:      e.currency,
    notes:         permissions.showNotes && e.notes ? e.notes : null,
    paymentMethod: permissions.showPaymentMethod ? (e.paymentMethod ?? null) : null,
    tags:          permissions.showTags ? (e.tags ?? []) : [],
    items: permissions.showItems && !permissions.showTotalsOnly
      ? (e.items ?? []).map((item) => ({
          name:     item.name,
          price:    permissions.showAmounts ? item.price : "***",
          quantity: item.quantity,
        }))
      : null,
  }))
}

/** Build aggregate summary (always uses real numbers — totals are always shown if showAmounts) */
export function buildPortalSummary(
  expenses: Expense[],
  permissions: PortalPermissions,
): PortalSummary {
  // Apply category + date filters before aggregating
  let filtered = [...expenses]
  if (permissions.dateRange) {
    const from = new Date(permissions.dateRange.from).getTime()
    const to   = new Date(permissions.dateRange.to).getTime()
    filtered = filtered.filter((e) => {
      const d = toDate(e.date).getTime()
      return d >= from && d <= to
    })
  }
  if (permissions.allowedCategories.length > 0) {
    filtered = filtered.filter((e) =>
      permissions.allowedCategories.includes(e.category ?? "otros"),
    )
  }

  const totalAmount = filtered.reduce((s, e) => s + e.total, 0)

  const byCategory = new Map<string, { total: number; count: number }>()
  filtered.forEach((e) => {
    const cat = e.category ?? "otros"
    const prev = byCategory.get(cat) ?? { total: 0, count: 0 }
    byCategory.set(cat, { total: prev.total + e.total, count: prev.count + 1 })
  })

  const dates = filtered.map((e) => toDate(e.date).getTime()).filter(Boolean)
  const dateRange = dates.length
    ? {
        from: new Date(Math.min(...dates)).toISOString(),
        to:   new Date(Math.max(...dates)).toISOString(),
      }
    : null

  return {
    totalAmount,
    expenseCount: filtered.length,
    byCategory: [...byCategory.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.total - a.total),
    dateRange,
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function toDate(val: unknown): Date {
  if (val && typeof val === "object" && "toDate" in val) {
    return (val as { toDate: () => Date }).toDate()
  }
  if (typeof val === "string" || typeof val === "number") return new Date(val)
  return new Date()
}

/** Generate a cryptographically random portal token */
export function generatePortalToken(): string {
  const arr = new Uint8Array(24)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("")
}
