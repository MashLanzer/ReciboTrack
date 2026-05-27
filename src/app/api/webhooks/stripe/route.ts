import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { getSupabase } from "@/lib/supabase/server"
import type Stripe from "stripe"

// Next.js necesita leer el body crudo para verificar la firma de Stripe
export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get("stripe-signature") ?? ""
  const secret    = process.env.STRIPE_WEBHOOK_SECRET!

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
      const session = event.data.object as Stripe.Checkout.Session
      const uid         = session.metadata?.uid
      const subId       = session.subscription as string
      const customerId  = session.customer as string
      if (!uid) break

      // Activar plan Pro
      const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items"] })
      const item       = sub.items.data[0]
      const periodEnd  = new Date(item.current_period_end * 1000).toISOString()
      const periodStart = new Date(item.current_period_start * 1000).toISOString()

      await sb.from("profiles").update({
        plan:                    "pro",
        plan_expires_at:         periodEnd,
        stripe_customer_id:      customerId,
        stripe_subscription_id:  subId,
      }).eq("uid", uid)

      await sb.from("subscriptions").upsert({
        uid,
        stripe_session_id:       session.id,
        stripe_subscription_id:  subId,
        stripe_customer_id:      customerId,
        status:                  "active",
        plan:                    "pro",
        period_start:            periodStart,
        period_end:              periodEnd,
        updated_at:              new Date().toISOString(),
      }, { onConflict: "stripe_subscription_id" })
      break
    }

    case "customer.subscription.updated": {
      const sub  = event.data.object as Stripe.Subscription
      const uid  = sub.metadata?.uid
      if (!uid) break

      const isActive    = sub.status === "active" || sub.status === "trialing"
      const item        = sub.items.data[0]
      const periodEnd   = new Date(item.current_period_end * 1000).toISOString()
      const periodStart = new Date(item.current_period_start * 1000).toISOString()

      await sb.from("profiles").update({
        plan:                   isActive ? "pro" : "free",
        plan_expires_at:        isActive ? periodEnd : null,
        stripe_subscription_id: sub.id,
      }).eq("uid", uid)

      await sb.from("subscriptions").upsert({
        uid,
        stripe_subscription_id: sub.id,
        stripe_customer_id:     sub.customer as string,
        status:                 sub.status,
        period_start:           periodStart,
        period_end:             periodEnd,
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
        plan: "free",
        plan_expires_at: null,
      }).eq("stripe_customer_id", customerId)
      break
    }
  }

  return NextResponse.json({ received: true })
}
