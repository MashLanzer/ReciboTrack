/**
 * Persiste las últimas preferencias del usuario (moneda, método de pago)
 * en localStorage para pre-rellenar formularios de gasto.
 */

const KEY_CURRENCY       = "rbt_last_currency"
const KEY_PAYMENT_METHOD = "rbt_last_payment_method"

export function getLastCurrency(fallback = "USD"): string {
  try { return localStorage.getItem(KEY_CURRENCY) ?? fallback } catch { return fallback }
}

export function setLastCurrency(currency: string): void {
  try { localStorage.setItem(KEY_CURRENCY, currency) } catch {}
}

export function getLastPaymentMethod(fallback = ""): string {
  try { return localStorage.getItem(KEY_PAYMENT_METHOD) ?? fallback } catch { return fallback }
}

export function setLastPaymentMethod(method: string): void {
  try { localStorage.setItem(KEY_PAYMENT_METHOD, method) } catch {}
}
