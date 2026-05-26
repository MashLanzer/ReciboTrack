import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"
import { getStripe, STRIPE_PRO_PRICE } from "@/lib/stripe"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://recibotrack.vercel.app"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid, email } = auth

  const stripe = getStripe()
  const sb = getSupabase()

  const { data: profile } = await sb
    .from("profiles")
    .select("stripe_customer_id, plan")
    .eq("uid", uid)
    .single()

  if (profile?.plan === "pro") {
    return NextResponse.json({ error: "Ya tienes el plan Pro" }, { status: 400 })
  }

  let customerId = profile?.stripe_customer_id as string | undefined

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: email ?? undefined,
      metadata: { uid },
    })
    customerId = customer.id

    await sb
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("uid", uid)
  }

  const session = await stripe.checkout.sessions.create({
    customer:             customerId,
    mode:                 "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency:    STRIPE_PRO_PRICE.currency,
          unit_amount: STRIPE_PRO_PRICE.amount,
          recurring:   { interval: STRIPE_PRO_PRICE.interval },
          product_data: {
            name:        STRIPE_PRO_PRICE.label,
            description: "Gastos ilimitados, exportación CSV/PDF, pronóstico IA y más",
          },
        },
        quantity: 1,
      },
    ],
    success_url:           `${BASE_URL}/dashboard?upgraded=1`,
    cancel_url:            `${BASE_URL}/pricing`,
    metadata:              { uid },
    subscription_data:     { metadata: { uid } },
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
