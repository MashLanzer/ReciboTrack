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

  try {
    const res = await getPlaid().linkTokenCreate({
      user: { client_user_id: auth.uid },
      client_name:   "ReciboTrack",
      products:      PLAID_PRODUCTS,
      country_codes: PLAID_COUNTRY_CODES,
      language:      "es",
      // webhook se configura en Fase 2; sin él Plaid no manda notificaciones.
    })
    return NextResponse.json({ link_token: res.data.link_token })
  } catch (err) {
    console.error("[plaid/link-token]", err)
    return NextResponse.json({ error: "No se pudo crear el link token de Plaid" }, { status: 500 })
  }
}
