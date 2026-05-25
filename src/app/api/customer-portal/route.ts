import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"
import { stripe } from "@/lib/stripe"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://recibotrack.vercel.app"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data: profile } = await getSupabase()
    .from("profiles")
    .select("stripe_customer_id")
    .eq("uid", uid)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "No tienes una suscripción activa" }, { status: 400 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer:   profile.stripe_customer_id,
    return_url: `${BASE_URL}/profile`,
  })

  return NextResponse.json({ url: session.url })
}
