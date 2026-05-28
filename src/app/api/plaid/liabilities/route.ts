/**
 * GET /api/plaid/liabilities
 *
 * Devuelve datos de crédito real del usuario desde los bancos conectados
 * via Plaid. Requiere el producto "liabilities" en el access_token del item
 * (activo para conexiones nuevas tras agregar Products.Liabilities).
 *
 * Los items conectados antes del cambio de productos devuelven error
 * PRODUCTS_NOT_SUPPORTED — se omiten gracefully.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { requirePremium } from "@/lib/plan"
import { getPlaid } from "@/lib/plaid"
import { getSupabase } from "@/lib/supabase/server"

export interface CreditCard {
  account_id:          string
  name:                string | null
  mask:                string | null
  institution_name:    string | null
  balance:             number
  credit_limit:        number | null
  utilization:         number | null  // 0–100 (%)
  interest_rate:       number | null  // APR %
  minimum_payment:     number | null
  next_payment_due:    string | null  // ISO date
  last_payment_date:   string | null
  last_payment_amount: number | null
  currency:            string | null
  overdue:             boolean
}

export interface LiabilitiesResponse {
  credit_cards:    CreditCard[]
  total_balance:   number
  total_limit:     number | null
  total_utilization: number | null  // 0–100 (%)
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth

  try {
    await requirePremium(auth.uid)
  } catch {
    return NextResponse.json({ error: "Premium required" }, { status: 402 })
  }

  const sb = getSupabase()
  const plaid = getPlaid()

  const { data: items } = await sb
    .from("plaid_items")
    .select("id, access_token, institution_name, status")
    .eq("uid", auth.uid)
    .eq("status", "active")

  if (!items || items.length === 0) {
    return NextResponse.json({ credit_cards: [], total_balance: 0, total_limit: null, total_utilization: null })
  }

  const { data: accounts } = await sb
    .from("plaid_accounts")
    .select("plaid_account_id, name, mask, item_id, currency")
    .eq("uid", auth.uid)
    .eq("type", "credit")

  const accountMap = new Map((accounts ?? []).map(a => [a.plaid_account_id, a]))
  const itemMap    = new Map(items.map(i => [i.id, i]))

  const allCards: CreditCard[] = []

  for (const item of items) {
    try {
      const res = await plaid.liabilitiesGet({ access_token: item.access_token })
      const liabilities = res.data.liabilities

      for (const cc of liabilities.credit ?? []) {
        const acct = res.data.accounts.find(a => a.account_id === cc.account_id)
        const localAcct = accountMap.get(cc.account_id)
        const balance = acct?.balances?.current ?? 0
        const limit = acct?.balances?.limit ?? null
        const utilization = limit && limit > 0 ? Math.min(Math.round((balance / limit) * 100), 100) : null

        const apr = cc.aprs?.find(a => a.apr_type === "purchase_apr")

        const today = new Date()
        const dueDate = cc.next_payment_due_date ? new Date(cc.next_payment_due_date) : null
        const overdue = dueDate != null && dueDate < today

        allCards.push({
          account_id:          cc.account_id ?? "",
          name:                localAcct?.name ?? acct?.name ?? null,
          mask:                localAcct?.mask ?? acct?.mask ?? null,
          institution_name:    item.institution_name ?? null,
          balance,
          credit_limit:        limit,
          utilization,
          interest_rate:       apr?.apr_percentage ?? null,
          minimum_payment:     cc.minimum_payment_amount ?? null,
          next_payment_due:    cc.next_payment_due_date ?? null,
          last_payment_date:   cc.last_payment_date ?? null,
          last_payment_amount: cc.last_payment_amount ?? null,
          currency:            localAcct?.currency ?? acct?.balances?.iso_currency_code ?? "USD",
          overdue,
        })
      }
    } catch {
      // Si el item no tiene liabilities habilitado → omitir silenciosamente
    }
  }

  const totalBalance = allCards.reduce((s, c) => s + c.balance, 0)
  const limitsKnown  = allCards.every(c => c.credit_limit != null)
  const totalLimit   = limitsKnown ? allCards.reduce((s, c) => s + (c.credit_limit ?? 0), 0) : null
  const totalUtil    = totalLimit && totalLimit > 0
    ? Math.min(Math.round((totalBalance / totalLimit) * 100), 100)
    : null

  return NextResponse.json({
    credit_cards:      allCards,
    total_balance:     totalBalance,
    total_limit:       totalLimit,
    total_utilization: totalUtil,
  } satisfies LiabilitiesResponse)
}
