import Stripe from "stripe"

// Singleton — no crear una instancia nueva en cada request
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-05-28.basil",
})

export const STRIPE_PRO_PRICE = {
  amount:   499,        // $4.99 USD
  currency: "usd",
  interval: "month" as const,
  label:    "ReciboTrack Pro",
}
