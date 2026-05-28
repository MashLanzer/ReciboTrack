/**
 * POST /api/plaid/items/[id]/reconnect
 *
 * Genera un link_token en "update mode" para que el usuario re-autentique
 * un item existente (login expirado, MFA, etc). Plaid Link en update
 * mode no pide elegir banco — abre directamente la institución del item.
 *
 * Tras un /exchange exitoso desde este flow, Plaid emite ITEM_LOGIN_REQUIRED
 * → false y el webhook lo marca status='active'.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { requirePremium } from "@/lib/plan"
import { getPlaid, PLAID_COUNTRY_CODES } from "@/lib/plaid"
import { getSupabase } from "@/lib/supabase/server"
import { maybeDecrypt } from "@/lib/encryption"

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth

  try {
    await requirePremium(auth.uid)
  } catch {
    return NextResponse.json({ error: "Premium plan requerido" }, { status: 402 })
  }

  const { id } = await params

  const { data: item } = await getSupabase()
    .from("plaid_items")
    .select("access_token")
    .eq("id", id)
    .eq("uid", auth.uid)
    .single()

  if (!item) return NextResponse.json({ error: "Banco no encontrado" }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://recibotrack.vercel.app"

  try {
    const res = await getPlaid().linkTokenCreate({
      user:            { client_user_id: auth.uid },
      client_name:     "ReciboTrack",
      country_codes:   PLAID_COUNTRY_CODES,
      language:        "es",
      access_token:    maybeDecrypt(item.access_token),   // ← esto activa "update mode"
      webhook:         `${appUrl}/api/plaid/webhook`,
    })
    return NextResponse.json({ link_token: res.data.link_token })
  } catch (err) {
    console.error("[plaid/reconnect]", err)
    return NextResponse.json({ error: "Error al iniciar reconexión" }, { status: 500 })
  }
}
