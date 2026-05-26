/**
 * POST /api/plaid/webhook
 *
 * Endpoint público que Plaid llama cuando hay novedad en un item:
 *   - SYNC_UPDATES_AVAILABLE   → hay tx nuevas; corremos /transactions/sync
 *   - INITIAL_UPDATE           → primer sync histórico listo
 *   - HISTORICAL_UPDATE        → ya bajó hasta 2 años de historial
 *   - DEFAULT_UPDATE / TRANSACTIONS_REMOVED → legacy, los manejamos por compat
 *   - ITEM_LOGIN_REQUIRED      → usuario debe re-autenticarse; status=error
 *   - ITEM_ERROR / PENDING_EXPIRATION → marcar el item con error_code
 *   - ITEM_REMOVED             → Plaid lo eliminó (o lo eliminamos nosotros)
 *
 * Verificación: JWT ES256 con sha256 del body — ver lib/plaid-webhook-verify.ts
 */
import { NextRequest, NextResponse } from "next/server"
import { verifyPlaidWebhook } from "@/lib/plaid-webhook-verify"
import { getSupabase } from "@/lib/supabase/server"
import { syncTransactions } from "@/lib/plaid-sync"

export const runtime = "nodejs"

interface PlaidWebhookBody {
  webhook_type:    string
  webhook_code:    string
  item_id?:        string
  error?:          { error_code?: string; error_message?: string; display_message?: string } | null
  new_transactions?: number
}

export async function POST(req: NextRequest) {
  const rawBody  = await req.text()
  const verifyHeader = req.headers.get("plaid-verification")

  const v = await verifyPlaidWebhook(rawBody, verifyHeader)
  if (!v.ok) {
    console.warn("[plaid/webhook] verification failed:", v.reason)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: PlaidWebhookBody
  try { payload = JSON.parse(rawBody) }
  catch { return NextResponse.json({ error: "bad json" }, { status: 400 }) }

  const sb = getSupabase()
  const { webhook_type, webhook_code, item_id, error } = payload

  // Resolvemos nuestro item.id local a partir del plaid_item_id
  let localItemId: string | null = null
  if (item_id) {
    const { data } = await sb
      .from("plaid_items")
      .select("id")
      .eq("plaid_item_id", item_id)
      .maybeSingle()
    localItemId = data?.id ?? null
  }

  // Si el webhook viene para un item que no tenemos (race con DELETE, p.ej.),
  // respondemos 200 para que Plaid no reintente.
  if (!localItemId && item_id && webhook_code !== "ITEM_REMOVED") {
    console.warn(`[plaid/webhook] unknown item ${item_id}, code ${webhook_code}`)
    return NextResponse.json({ ok: true, ignored: "unknown item" })
  }

  try {
    if (webhook_type === "TRANSACTIONS") {
      switch (webhook_code) {
        case "SYNC_UPDATES_AVAILABLE":
        case "INITIAL_UPDATE":
        case "HISTORICAL_UPDATE":
        case "DEFAULT_UPDATE":
          if (localItemId) await syncTransactions(localItemId)
          break
        case "TRANSACTIONS_REMOVED":
          // Sync se encarga del removed array; basta correr el sync regular
          if (localItemId) await syncTransactions(localItemId)
          break
        default:
          console.log(`[plaid/webhook] unhandled TRANSACTIONS code: ${webhook_code}`)
      }
    } else if (webhook_type === "ITEM") {
      switch (webhook_code) {
        case "ITEM_LOGIN_REQUIRED":
        case "PENDING_EXPIRATION":
        case "ERROR":
          if (localItemId) {
            await sb
              .from("plaid_items")
              .update({
                status:        "error",
                error_code:    error?.error_code    ?? webhook_code,
                error_message: error?.display_message ?? error?.error_message ?? null,
                updated_at:    new Date().toISOString(),
              })
              .eq("id", localItemId)
          }
          break
        case "USER_PERMISSION_REVOKED":
        case "ITEM_REMOVED":
          if (localItemId) {
            await sb.from("plaid_items").delete().eq("id", localItemId)
          }
          break
        default:
          console.log(`[plaid/webhook] unhandled ITEM code: ${webhook_code}`)
      }
    } else {
      console.log(`[plaid/webhook] unhandled webhook_type: ${webhook_type}`)
    }
  } catch (err) {
    console.error("[plaid/webhook] handler error", err)
    // 500 para que Plaid reintente con backoff
    return NextResponse.json({ error: "handler failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
