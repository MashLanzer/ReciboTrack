import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

const BELVO_BASE = process.env.BELVO_ENV === "production"
  ? "https://api.belvo.com"
  : "https://sandbox.belvo.com"

function getBelvoHeaders() {
  const id     = process.env.BELVO_SECRET_ID ?? ""
  const secret = process.env.BELVO_SECRET_PASSWORD ?? ""
  return {
    "Authorization": `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    "Content-Type": "application/json",
  }
}

function mapCategory(belvoCategory: string | null): string {
  const map: Record<string, string> = {
    "Food & Groceries": "supermercado",
    "Online Platforms & Leisure": "ocio",
    "Transport & Travel": "transporte",
    "Home & Life": "hogar",
    "Healthcare & Wellness": "salud",
    "Personal Finance": "servicios",
    "Income": "servicios",
  }
  if (!belvoCategory) return "otros"
  for (const [key, val] of Object.entries(map)) {
    if (belvoCategory.includes(key)) return val
  }
  return "otros"
}

export async function POST(req: NextRequest) {
  let uid: string
  let linkId: string

  // Allow both authenticated requests and internal server calls
  const authHeader = req.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    const auth = await requireAuth(req, "pay")
    if (auth instanceof NextResponse) return auth
    uid = auth.uid
    const body = await req.json() as { linkId: string }
    linkId = body.linkId
  } else {
    const body = await req.json() as { uid: string; linkId: string }
    uid = body.uid
    linkId = body.linkId
  }

  if (!uid || !linkId) {
    return NextResponse.json({ error: "uid y linkId son requeridos" }, { status: 400 })
  }

  const sb = getSupabase()

  // Fetch connection
  const { data: conn } = await sb
    .from("bank_connections")
    .select("id")
    .eq("uid", uid)
    .eq("belvo_link_id", linkId)
    .single()

  if (!conn) return NextResponse.json({ error: "Conexión no encontrada" }, { status: 404 })

  // Fetch transactions from Belvo (last 90 days)
  const dateTo   = new Date().toISOString().split("T")[0]
  const dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  let belvoTxns: Record<string, unknown>[] = []
  try {
    const res = await fetch(`${BELVO_BASE}/api/transactions/`, {
      method: "POST",
      headers: getBelvoHeaders(),
      body: JSON.stringify({
        link: linkId,
        date_from: dateFrom,
        date_to: dateTo,
        save_data: true,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error("[Belvo] sync error:", err)
      return NextResponse.json({ error: "Error al sincronizar transacciones" }, { status: 500 })
    }

    belvoTxns = await res.json() as Record<string, unknown>[]
  } catch (err) {
    console.error("[Belvo] fetch error:", err)
    return NextResponse.json({ error: "Error de red" }, { status: 500 })
  }

  let imported = 0
  let skipped = 0

  for (const txn of belvoTxns) {
    const txnId  = String(txn.id ?? "")
    const amount = Math.abs(Number(txn.amount ?? 0))
    const merchant = String((txn.merchant as Record<string, unknown> | null)?.name ?? txn.description ?? "Transacción bancaria")
    const date   = String(txn.accounting_date ?? txn.value_date ?? "").split("T")[0]
    const currency = String(txn.currency ?? "MXN")
    const category = mapCategory(txn.category as string | null)

    // Only import outflows (debits)
    if (Number(txn.amount) >= 0) { skipped++; continue }
    if (!txnId || !date || amount <= 0) { skipped++; continue }

    // Check if already imported
    const { data: existing } = await sb
      .from("bank_transactions")
      .select("id")
      .eq("belvo_txn_id", txnId)
      .maybeSingle()

    if (existing) { skipped++; continue }

    // Create expense
    const { data: expense } = await sb.from("expenses").insert({
      uid,
      account: "personal",
      merchant: merchant.slice(0, 80),
      date,
      items: [],
      subtotal: amount,
      tax: 0,
      total: amount,
      payment_method: null,
      reference: null,
      category,
      currency,
      notes: "",
      tags: ["banco-conectado"],
      receipt_image_url: null,
      project: null,
      project_id: null,
      privacy: "private",
      archived: false,
      flagged: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select("id").single()

    // Record bank transaction
    await sb.from("bank_transactions").insert({
      uid,
      connection_id: conn.id,
      belvo_txn_id: txnId,
      expense_id: expense?.id ?? null,
      merchant: merchant.slice(0, 80),
      amount,
      currency,
      date,
      category,
      status: "imported",
      raw_data: txn,
    })

    imported++
  }

  // Update last synced
  await sb.from("bank_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("belvo_link_id", linkId)

  return NextResponse.json({ imported, skipped })
}
