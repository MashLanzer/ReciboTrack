import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { signPayToken } from "@/lib/pay-token"
import { PayLinkSchema } from "@/lib/api-schemas"
import { getSupabase } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const parsed = PayLinkSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
    const { from, to, amount, concept, currency } = parsed.data

    // Look up the requester's payment handles so receivers see their PayPal/Venmo/Cash App buttons.
    const { data: profile } = await getSupabase()
      .from("profiles")
      .select("paypal_handle, venmo_handle, cashapp_cashtag")
      .eq("uid", auth.uid)
      .maybeSingle()

    const token = await signPayToken({
      from,
      to,
      amount,
      concept:  concept  ?? "",
      currency: currency ?? "USD",
      paypal:   profile?.paypal_handle    ?? null,
      venmo:    profile?.venmo_handle     ?? null,
      cashapp:  profile?.cashapp_cashtag  ?? null,
    })
    return NextResponse.json({ token })
  } catch {
    return NextResponse.json({ error: "Error generando token" }, { status: 500 })
  }
}
