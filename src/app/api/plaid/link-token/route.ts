/**
 * POST /api/plaid/link-token
 *
 * Genera un `link_token` efímero que el frontend pasa a Plaid Link.
 * Plaid Link abre un modal donde el usuario elige su banco y se autentica.
 * Al éxito devuelve un `public_token` que la app intercambia en /api/plaid/exchange.
 *
 * Pro-only: bank sync es una feature paga.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { requirePro } from "@/lib/plan"
import { getPlaid, PLAID_PRODUCTS, PLAID_COUNTRY_CODES } from "@/lib/plaid"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth

  try {
    await requirePro(auth.uid)
  } catch {
    return NextResponse.json(
      { error: "Bank sync requires Pro plan", upgrade: "/pricing" },
      { status: 402 },
    )
  }

  // URL pública del webhook — Plaid llamará aquí cuando hay tx nuevas, login
  // expirado, etc. NEXT_PUBLIC_APP_URL debe estar configurada en Vercel.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://recibotrack.vercel.app"
  const webhookUrl = `${appUrl}/api/plaid/webhook`

  try {
    const res = await getPlaid().linkTokenCreate({
      user: { client_user_id: auth.uid },
      client_name:   "ReciboTrack",
      products:      PLAID_PRODUCTS,
      country_codes: PLAID_COUNTRY_CODES,
      language:      "es",
      webhook:       webhookUrl,
    })
    return NextResponse.json({ link_token: res.data.link_token })
  } catch (err) {
    // Plaid devuelve el detalle en err.response.data — propagamos para que la UI
    // pueda mostrar al usuario qué pasó (INVALID_API_KEYS, env mismatch, etc.).
    const e = err as { response?: { data?: { error_code?: string; error_message?: string; display_message?: string } }; message?: string }
    const plaidDetail = e.response?.data
    const detail = plaidDetail?.display_message
                 || plaidDetail?.error_message
                 || plaidDetail?.error_code
                 || e.message
                 || "Error desconocido"
    console.error("[plaid/link-token]", plaidDetail || err)
    return NextResponse.json(
      { error: `Plaid: ${detail}`, code: plaidDetail?.error_code ?? null },
      { status: 500 },
    )
  }
}
