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
  createdAt: Timestamp
  updatedAt: Timestamp
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
}

export type RecurringFrequency = "weekly" | "biweekly" | "monthly" | "yearly"

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
