import { Timestamp } from "firebase/firestore"

export interface ReceiptItem {
  name: string
  price: number
  quantity: number
}

export type Category =
  | "combustible"
  | "comida"
  | "supermercado"
  | "transporte"
  | "ocio"
  | "salud"
  | "hogar"
  | "servicios"
  | "otros"

export interface Expense {
  id: string
  account?: "personal" | "business"  // absent = personal (legacy)
  merchant: string
  date: Timestamp
  items: ReceiptItem[]
  subtotal: number
  tax: number
  total: number
  paymentMethod: string | null
  reference: string | null
  category: string
  currency: string
  notes: string
  tags: string[]
  receiptImageUrl: string | null
  project?: string  // nombre del cliente/proyecto
  projectId?: string | null  // ID de proyecto real (entidad)
  privacy?: "private" | "group" | "public"
  archived?: boolean
  flagged?: boolean
  flaggedAt?: Timestamp
  recurringId?: string
  createdAt: Timestamp
  updatedAt: Timestamp
  // Geolocalización (opcional — solo si el usuario activó ubicación)
  geo?: { lat: number; lng: number; accuracy?: number }
  cityName?: string | null
  countryCode?: string | null
}

export interface ExpenseInput {
  merchant: string
  date: Date
  items: ReceiptItem[]
  subtotal: number
  tax: number
  total: number
  paymentMethod: string | null
  reference: string | null
  category: string
  currency: string
  notes: string
  tags: string[]
  receiptImageUrl: string | null
  account?: "personal" | "business"  // defaults to "personal" when absent
  project?: string  // nombre del cliente/proyecto
  projectId?: string | null  // ID de proyecto real (entidad)
  privacy?: "private" | "group" | "public"
  archived?: boolean
  flagged?: boolean
  // Geolocalización capturada con GeoPicker
  geo?: { lat: number; lng: number; accuracy?: number }
  cityName?: string | null
  countryCode?: string | null
}

export interface CategoryDoc {
  id: string
  name: string
  icon: string
  color: string
  isDefault: boolean
}

export interface Budget {
  id: string
  categoryId: string
  monthlyLimit: number
  currency: string
  rolloverEnabled?: boolean
}

export interface TravelBudget {
  id: string
  name: string
  emoji: string
  totalLimit: number
  currency: string
  startDate: Timestamp
  endDate: Timestamp
  tags: string[]        // expenses with these tags count toward this budget
  createdAt: Timestamp
}

export type RecurringFrequency = "weekly" | "biweekly" | "monthly" | "yearly"

export interface PriceHistoryEntry {
  date: string          // "YYYY-MM-DD"
  previousTotal: number
  newTotal: number
}

export interface RecurringTemplate {
  id: string
  merchant: string
  category: string
  subtotal: number
  tax: number
  total: number
  paymentMethod: string | null
  currency: string
  notes: string
  tags: string[]
  frequency: RecurringFrequency
  nextDueDate: Timestamp
  isActive: boolean
  createdAt: Timestamp
  lastLinkedExpenseId?: string
  lastLinkedAt?: Timestamp
  priceHistory?: PriceHistoryEntry[]
}

export interface UserProfile {
  displayName: string
  email: string
  photoURL: string | null
  createdAt: Timestamp
  defaultCurrency: string
}

export interface OcrResult {
  merchant: string | null
  date: string | null
  items: ReceiptItem[]
  subtotal: number | null
  tax: number | null
  total: number | null
  paymentMethod: string | null
  reference: string | null
  category: Category | null
  currency: string | null
}

// ─── Categorization rules ─────────────────────────────────────────────────────

export type RuleField = "merchant" | "amount_min" | "amount_max" | "notes"
export type RuleOperator = "contains" | "starts_with" | "equals"

export interface CategoryRule {
  id: string
  /** Display name for the rule */
  name: string
  /** Field to match against */
  field: RuleField
  /** Match operator */
  operator: RuleOperator
  /** Value to match (string; for amount fields, coerced to number) */
  value: string
  /** Target category to assign */
  categoryId: string
  /** Order priority — lower = applied first */
  order: number
  enabled: boolean
  createdAt: Timestamp
}

export interface CategoryRuleInput {
  name: string
  field: RuleField
  operator: RuleOperator
  value: string
  categoryId: string
  order: number
  enabled: boolean
}

export interface QuickExpense {
  id: string
  label: string          // display name (can differ from merchant)
  merchant: string
  amount: number
  category: string
  currency: string
  paymentMethod: string | null
  tags: string[]
  icon: string           // emoji
  order: number
  createdAt: Timestamp
}

export interface QuickExpenseInput {
  label: string
  merchant: string
  amount: number
  category: string
  currency: string
  paymentMethod: string | null
  tags: string[]
  icon: string
  order: number
}

export interface DashboardStats {
  currentMonthTotal: number
  previousMonthTotal: number
  yearTotal: number
  dailyAverage: number
  categoryBreakdown: { category: string; total: number }[]
  monthlyTrend: { month: string; total: number }[]
  topMerchants: { merchant: string; total: number }[]
  paymentMethods: { method: string; total: number }[]
}

// ─── Trusted Circle ───────────────────────────────────────────────────────────

export interface TrustedCircleMember {
  id: string
  userId: string
  displayName: string
  email: string
  addedAt: Timestamp
  canSeeFullBudget: boolean
  linked?: boolean  // true si el miembro tiene un UID real (no es invitación pendiente)
}

export interface TrustedCircleMemberInput {
  userId: string
  displayName: string
  email: string
  canSeeFullBudget: boolean
  linked?: boolean  // true si se encontró un UID real via userDirectory lookup
}

// ─── Pinned Items ─────────────────────────────────────────────────────────────

export interface PinnedItem {
  type: "category" | "goal" | "alert"
  id: string
  label: string
  icon: string
}

// ─── Group Wishlist ───────────────────────────────────────────────────────────

export interface WishlistItem {
  id: string
  title: string
  url?: string
  estimatedPrice?: number
  currency: string
  addedBy: string
  likes: string[]
  purchased: boolean
  purchasedBy?: string
  purchasedAt?: Timestamp
  createdAt: Timestamp
}

export interface WishlistItemInput {
  title: string
  url?: string
  estimatedPrice?: number
  currency: string
}

// ─── Group Notes ──────────────────────────────────────────────────────────────

export interface GroupNote {
  userId: string
  text: string
  createdAt: Timestamp
  expiresAt: Timestamp
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export interface Client {
  id: string
  name: string
  email?: string
  phone?: string
  notes?: string
  color: string
  createdAt: Timestamp
  isActive: boolean
}

export interface ClientInput {
  name: string
  email?: string
  phone?: string
  notes?: string
  color: string
  isActive: boolean
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
  clientId: string | null
  clientName: string | null
  description: string | null
  budget: number | null
  currency: string
  status: "active" | "completed" | "archived"
  color: string
  createdAt: string
  updatedAt: string
}

export interface ProjectInput {
  name: string
  clientId?: string | null
  description?: string | null
  budget?: number | null
  currency?: string
  status?: "active" | "completed" | "archived"
  color?: string
}
