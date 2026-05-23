import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns"
import { es } from "date-fns/locale"
import { Timestamp } from "firebase/firestore"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: Date | Timestamp, pattern = "dd MMM yyyy"): string {
  const d = date instanceof Timestamp ? date.toDate() : date
  return format(d, pattern, { locale: es })
}

export function formatMonth(date: Date): string {
  return format(date, "MMM yyyy", { locale: es })
}

export function getCurrentMonthRange() {
  const now = new Date()
  return { start: startOfMonth(now), end: endOfMonth(now) }
}

export function getPreviousMonthRange() {
  const prev = subMonths(new Date(), 1)
  return { start: startOfMonth(prev), end: endOfMonth(prev) }
}

export function getYearStart() {
  return startOfYear(new Date())
}

export function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export function toDate(value: Date | Timestamp): Date {
  return value instanceof Timestamp ? value.toDate() : value
}

/**
 * Strips keys whose value is `undefined` before writing to Firestore.
 * Firestore rejects documents that contain `undefined` — this prevents
 * "Unsupported field value: undefined" errors when optional form fields
 * are left blank and passed through as `undefined`.
 */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>
}

/**
 * Compact currency format — shows K/M suffix for large numbers on mobile.
 * Falls back to full precision for amounts < 10 000.
 */
export function formatCompact(amount: number, currency = "USD"): string {
  const abs = Math.abs(amount)
  if (abs >= 10_000) {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount)
  }
  return formatCurrency(amount, currency)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}
