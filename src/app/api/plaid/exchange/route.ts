/**
 * POST /api/plaid/exchange
 *
 * Intercambia el `public_token` (que el frontend recibió de Plaid Link)
 * por un `access_token` permanente, guarda el item + accounts en Supabase
 * y dispara un sync inicial de transacciones.
 *
 * Body: { public_token: string, institution?: { id, name } }
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { requirePro } from "@/lib/plan"
import { getPlaid, PLAID_COUNTRY_CODES } from "@/lib/plaid"
import { getSupabase } from "@/lib/supabase/server"
import { syncTransactions } from "@/lib/plaid-sync"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth

  try {
    await requirePro(auth.uid)
  } catch {
    return NextResponse.json({ error: "Pro plan requerido" }, { status: 402 })
  }

  let body: { public_token?: string; institution?: { id: string; name: string } }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  if (!body.public_token) {
    return NextResponse.json({ error: "public_token requerido" }, { status: 400 })
  }

  const plaid = getPlaid()
  const sb    = getSupabase()

  try {
    // 1. Cambiar public_token por access_token + item_id (permanentes)
    const exchange = await plaid.itemPublicTokenExchange({ public_token: body.public_token })
    const accessToken = exchange.data.access_token
    const plaidItemId = exchange.data.item_id

    // 2a. Fetch logo + color de la institución (best-effort — si falla,
    //     seguimos sin branding, no es crítico para el flow).
    let logoDataUrl: string | null = null
    let primaryColor: string | null = null
    if (body.institution?.id) {
      try {
        const inst = await plaid.institutionsGetById({
          institution_id:  body.institution.id,
          country_codes:   PLAID_COUNTRY_CODES,
          options:         { include_optional_metadata: true },
        })
        const i = inst.data.institution
        logoDataUrl = i.logo ? `data:image/png;base64,${i.logo}` : null
        primaryColor = i.primary_color ?? null
      } catch (err) {
        console.warn("[plaid/exchange] institutionsGetById failed", err)
      }
    }

    // 2b. Insertar el item en nuestra DB
    const { data: item, error: itemErr } = await sb
      .from("plaid_items")
      .insert({
        uid:               auth.uid,
        plaid_item_id:     plaidItemId,
        access_token:      accessToken,
        institution_id:    body.institution?.id   ?? null,
        institution_name:  body.institution?.name ?? null,
        logo:              logoDataUrl,
        primary_color:     primaryColor,
      })
      .select()
      .single()

    if (itemErr) {
      console.error("[plaid/exchange] insert item", itemErr)
      return NextResponse.json({ error: itemErr.message }, { status: 500 })
    }

    // 3. Obtener accounts del item y guardarlos
    const accountsRes = await plaid.accountsGet({ access_token: accessToken })
    const accountRows = accountsRes.data.accounts.map((a) => ({
      item_id:           item.id,
      uid:               auth.uid,
      plaid_account_id:  a.account_id,
      name:              a.name,
      official_name:     a.official_name ?? null,
      mask:              a.mask ?? null,
      type:              a.type ?? null,
      subtype:           a.subtype ?? null,
      current_balance:   a.balances.current ?? null,
      available_balance: a.balances.available ?? null,
      currency:          a.balances.iso_currency_code ?? null,
    }))
    if (accountRows.length > 0) {
      const { error: accErr } = await sb.from("plaid_accounts").insert(accountRows)
      if (accErr) console.error("[plaid/exchange] insert accounts", accErr)
    }

    // 4. Sync inicial de transacciones (async, sin bloquear la respuesta es ideal,
    //    pero en serverless awaitamos para garantizar import antes del primer GET).
    const syncResult = await syncTransactions(item.id).catch((err) => {
      console.error("[plaid/exchange] initial sync failed", err)
      return { added: 0, modified: 0, removed: 0, error: String(err) }
    })

    return NextResponse.json({
      ok: true,
      item: {
        id:                item.id,
        institution_name:  item.institution_name,
        accounts_count:    accountRows.length,
      },
      sync: syncResult,
    })
  } catch (err) {
    console.error("[plaid/exchange]", err)
    return NextResponse.json({ error: "Error al conectar con el banco" }, { status: 500 })
  }
}
