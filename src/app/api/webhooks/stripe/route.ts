import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { getSupabase } from "@/lib/supabase/server"
import type Stripe from "stripe"
import type { Plan } from "@/lib/plan-config"

// Next.js necesita leer el body crudo para verificar la firma de Stripe
export const runtime = "nodejs"

// En Stripe API 2026-04-22.dahlia las fechas de período están en el primer item
function getPeriodDates(sub: Stripe.Subscription): { start: string; end: string } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const item = sub.items?.data?.[0] as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s    = sub as any
  const end   = item?.current_period_end   ?? s.current_period_end   ?? 0
  const start = item?.current_period_start ?? s.current_period_start ?? 0
  return {
    start: new Date(start * 1000).toISOString(),
    end:   new Date(end   * 1000).toISOString(),
  }
}

/**
 * Mapea el price_id de Stripe al plan local. Se configura por env vars
 * para no hardcodear en código:
 *   - STRIPE_PRO_PRICE_ID      → "pro"
 *   - STRIPE_PREMIUM_PRICE_ID  → "premium"
 *
 * Si solo está configurado uno (caso actual: solo el Premium $4.99),
 * cualquier checkout asume "premium". Cuando se cree el producto Pro
 * $1.99 y se setee STRIPE_PRO_PRICE_ID, se distinguirá correctamente.
 */
function planFromPriceId(priceId: string | null | undefined): Plan {
  if (!priceId) return "premium"
  if (priceId === process.env.STRIPE_PRO_PRICE_ID)     return "pro"
  if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) return "premium"
  // Fallback: si no matchea ninguno, asumimos el plan más alto que existió
  // (= legacy $4.99 product que ahora mapea a Premium).
  return "premium"
}

function planFromSubscription(sub: Stripe.Subscription): Plan {
  const priceId = sub.items?.data?.[0]?.price?.id
  return planFromPriceId(priceId)
}

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get("stripe-signature") ?? ""
  const secret    = process.env.STRIPE_WEBHOOK_SECRET!
  const stripe    = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret)
  } catch (err) {
    return NextResponse.json(
      { error: `Firma inválida: ${(err as Error).message}` },
      { status: 400 }
    )
  }

  const sb = getSupabase()

  switch (event.type) {
    case "checkout.session.completed": {
      const session    = event.data.object as Stripe.Checkout.Session
      const uid        = session.metadata?.uid
      const subId      = session.subscription as string
      const customerId = session.customer as string
      if (!uid) break

      const sub    = await stripe.subscriptions.retrieve(subId)
      const period = getPeriodDates(sub)
      const plan   = planFromSubscription(sub)

      await sb.from("profiles").update({
        plan,
        plan_expires_at:         period.end,
        stripe_customer_id:      customerId,
        stripe_subscription_id:  subId,
      }).eq("uid", uid)

      await sb.from("subscriptions").upsert({
        uid,
        stripe_session_id:       session.id,
        stripe_subscription_id:  subId,
        stripe_customer_id:      customerId,
        status:                  "active",
        plan,
        period_start:            period.start,
        period_end:              period.end,
        updated_at:              new Date().toISOString(),
      }, { onConflict: "stripe_subscription_id" })
      break
    }

    case "customer.subscription.updated": {
      const sub    = event.data.object as Stripe.Subscription
      const uid    = sub.metadata?.uid
      if (!uid) break

      const isActive = sub.status === "active" || sub.status === "trialing"
      const period   = getPeriodDates(sub)
      const plan     = isActive ? planFromSubscription(sub) : "free"

      await sb.from("profiles").update({
        plan,
        plan_expires_at:        isActive ? period.end : null,
        stripe_subscription_id: sub.id,
      }).eq("uid", uid)

      await sb.from("subscriptions").upsert({
        uid,
        stripe_subscription_id: sub.id,
        stripe_customer_id:     sub.customer as string,
        status:                 sub.status,
        plan,
        period_start:           period.start,
        period_end:             period.end,
        updated_at:             new Date().toISOString(),
      }, { onConflict: "stripe_subscription_id" })
      break
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription
      const uid = sub.metadata?.uid
      if (!uid) break

      await sb.from("profiles").update({
        plan:                   "free",
        plan_expires_at:        null,
        stripe_subscription_id: null,
      }).eq("uid", uid)

      await sb.from("subscriptions").update({
        status:     "canceled",
        updated_at: new Date().toISOString(),
      }).eq("stripe_subscription_id", sub.id)
      break
    }

    case "invoice.payment_failed": {
      const invoice    = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      await sb.from("profiles").update({
        plan:            "free",
        plan_expires_at: null,
      }).eq("stripe_customer_id", customerId)
      break
    }
  }

  return NextResponse.json({ received: true })
}
