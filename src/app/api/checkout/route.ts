import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe"
import type { Plan } from "@/lib/plan-config"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://recibotrack.vercel.app"

/**
 * POST /api/checkout
 * Body: { plan: "pro" | "premium" }
 *
 * Crea una Stripe Checkout Session para suscripción. Soporta los 2 tiers
 * de pago. Usa los price IDs pre-creados en Stripe (env vars). Fallback
 * al precio Premium si no se especifica plan (mantener compat con UI
 * antigua que llamaba sin body).
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid, email } = auth

  // Plan deseado del body (default: premium para retro-compat)
  let requestedPlan: Plan = "premium"
  try {
    const body = await req.json() as { plan?: Plan }
    if (body.plan === "pro" || body.plan === "premium") requestedPlan = body.plan
  } catch { /* no body, usar default */ }

  const priceId = requestedPlan === "pro"
    ? process.env.STRIPE_PRO_PRICE_ID
    : process.env.STRIPE_PREMIUM_PRICE_ID

  if (!priceId) {
    return NextResponse.json(
      { error: `Plan ${requestedPlan} no está disponible aún. Configura STRIPE_${requestedPlan.toUpperCase()}_PRICE_ID en Vercel.` },
      { status: 503 },
    )
  }

  const stripe = getStripe()
  const sb = getSupabase()

  const { data: profile } = await sb
    .from("profiles")
    .select("stripe_customer_id, plan")
    .eq("uid", uid)
    .single()

  // Bloquear si ya tiene el mismo plan o superior
  if (profile?.plan === "premium") {
    return NextResponse.json({ error: "Ya tienes el plan Premium" }, { status: 400 })
  }
  if (profile?.plan === "pro" && requestedPlan === "pro") {
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
    line_items:           [{ price: priceId, quantity: 1 }],
    success_url:          `${BASE_URL}/dashboard?upgraded=1`,
    cancel_url:           `${BASE_URL}/pricing`,
    metadata:             { uid, plan: requestedPlan },
    subscription_data:    { metadata: { uid, plan: requestedPlan } },
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
