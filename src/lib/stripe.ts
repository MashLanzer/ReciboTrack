import Stripe from "stripe"

// Lazy singleton — se inicializa solo en el primer request, no en build time
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error("STRIPE_SECRET_KEY no está configurada en las variables de entorno")
    _stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia" })
  }
  return _stripe
}

export const STRIPE_PRO_PRICE = {
  amount:   499,        // $4.99 USD
  currency: "usd",
  interval: "month" as const,
  label:    "ReciboTrack Pro",
}
